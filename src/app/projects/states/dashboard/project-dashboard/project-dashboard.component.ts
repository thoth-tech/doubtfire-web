import {CdkDragEnd, CdkDragMove, CdkDragStart} from '@angular/cdk/drag-drop';
import {BreakpointObserver} from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {BehaviorSubject, Observable, Subject, filter, map, of, takeUntil} from 'rxjs';
import {Project, TaskDefinition} from 'src/app/api/models/doubtfire-model';
import {ProjectService} from 'src/app/api/services/project.service';
import {TaskService} from 'src/app/api/services/task.service';
import {UnitService} from 'src/app/api/services/unit.service';
import {UserService} from 'src/app/api/services/user.service';
import {FUnitTaskListComponent} from 'src/app/units/task-viewer/directives/unit-task-list/unit-task-list.component';
import {GlobalStateService, ViewType} from '../../index/global-state.service';

@Component({
  selector: 'f-project-dashboard',
  templateUrl: './project-dashboard.component.html',
  styleUrl: './project-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ProjectDashboardComponent implements OnInit, OnDestroy {
  @ViewChild('leftPanel') private leftPanel?: FUnitTaskListComponent;

  @Input() public project$: Observable<Project>;
  @Input() public defaultTaskListCollapsed = false;
  @Input() public taskSelectionUrlBase: unknown[] | null = null;
  @Input() public showSubmittedGrade?: boolean = false;
  @Input() public set taskListWidth(width: number | undefined) {
    if (typeof width === 'number') {
      this._leftWidth = width;
    }
  }

  @Output() public taskListWidthChange: EventEmitter<number> = new EventEmitter();

  /**
   * The currently selected task definition - selected in the unit task list.
   * This is crated here, and passed to children to interact with and share across context.
   */
  public selectedTaskDefinition$: BehaviorSubject<TaskDefinition> =
    new BehaviorSubject<TaskDefinition>(null);

  subs$: Observable<unknown> = of(true);
  readonly skeletonRows = Array.from({length: 10}, (_, index) => index);
  private readonly projectSubject: BehaviorSubject<Project> = new BehaviorSubject(null);

  private readonly destroy$: Subject<void> = new Subject();
  private readonly projectLoadCancel$: Subject<void> = new Subject();
  private projectReady = false;
  private activeProjectId: number | null = null;
  private projectActivation = 0;

  projectTasks = [];

  constructor(
    private currentUser: UserService,
    private projectService: ProjectService,
    private taskService: TaskService,
    private unitService: UnitService,
    private globalStateService: GlobalStateService,
    private route: ActivatedRoute,
    private breakpointObserver: BreakpointObserver,
    private angularRouter: Router,
  ) {}

  public readonly taskListCollapsedWidth = 75;
  public readonly taskListExpandedWidth = 400;
  public readonly taskListCollapseThreshold = 125;
  private _leftWidth = this.taskListExpandedWidth;
  public lastX;
  public startWidth = 0;

  public startLeftX = 0;
  public isCommentsNarrow = false;
  public commentsCollapsed = false;
  public isPhoneLayout = false;
  public mobilePane: 'overview' | 'task' | 'feedback' = 'task';

  private readonly commentsBreakpoint = '(max-width: 999.98px)';
  private readonly phoneBreakpoint = '(max-width: 639.98px)';

  public get commentsPanelCollapsed(): boolean {
    return this.isCommentsNarrow && this.commentsCollapsed;
  }

  public get taskListCollapsed(): boolean {
    return this.leftWidth < this.taskListCollapseThreshold;
  }

  public get leftWidth(): number {
    return this._leftWidth;
  }

  public set leftWidth(width: number) {
    this._leftWidth = width;
    this.taskListWidthChange.emit(width);
  }

  public isProjectTaskListReady(project: Project): boolean {
    return (
      this.projectReady &&
      !!project?.id &&
      !!project.unit?.id &&
      project.targetGrade !== undefined &&
      project.targetGrade !== null
    );
  }

  public taskDefinitionsForProject(project: Project): readonly TaskDefinition[] {
    if (!this.isProjectTaskListReady(project)) {
      return [];
    }

    return project.unit.taskDefinitions;
  }

  startedDragging(event: CdkDragStart, boundary: HTMLElement) {
    document.body.classList.add('split-pane-resizing');
    event.source.element.nativeElement.classList.add('hovering');
    const rect = boundary.getBoundingClientRect();
    // x relative to the container
    this.startLeftX = (event.event as MouseEvent).clientX - rect.left;
    this.startWidth = this.leftWidth;
  }

  dragging(event: CdkDragMove, boundary: HTMLElement) {
    const rect = boundary.getBoundingClientRect();
    const x = (event.event as MouseEvent).clientX - rect.left;

    const delta = x - this.startLeftX;
    const newWidth = this.startWidth + delta;

    this.leftWidth = Math.max(this.taskListCollapsedWidth, Math.min(500, newWidth));

    // keep the handle visually glued to the divider
    event.source.reset();
  }

  stoppedDragging(event: CdkDragEnd, _div: HTMLDivElement) {
    document.body.classList.remove('split-pane-resizing');
    event.source.element.nativeElement.classList.remove('hovering');
  }

  ngOnInit(): void {
    this.breakpointObserver
      .observe(this.commentsBreakpoint)
      .pipe(takeUntil(this.destroy$))
      .subscribe(({matches}) => {
        this.isCommentsNarrow = matches;
        this.commentsCollapsed = matches;
        window.dispatchEvent(new Event('resize'));
      });

    this.breakpointObserver
      .observe(this.phoneBreakpoint)
      .pipe(takeUntil(this.destroy$))
      .subscribe(({matches}) => {
        this.isPhoneLayout = matches;
        if (matches && this.selectedTaskDefinition$.value) {
          this.mobilePane = this.shouldOpenFeedback(this.selectedTaskDefinition$.value)
            ? 'feedback'
            : 'task';
        }
        window.dispatchEvent(new Event('resize'));
      });

    this.selectedTaskDefinition$.pipe(takeUntil(this.destroy$)).subscribe((taskDefinition) => {
      if (!taskDefinition) {
        this.mobilePane = 'task';
        return;
      }

      if (this.isPhoneLayout) {
        // A task opened from a notification/deep link should expose its feedback immediately.
        // A task chosen from the list is selected before its route is updated, so it starts on
        // the task pane instead.
        this.mobilePane = this.shouldOpenFeedback(taskDefinition) ? 'feedback' : 'task';
      }
    });

    this.route.paramMap?.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      if (
        this.isPhoneLayout &&
        params.get('mobilePane') === 'feedback' &&
        this.selectedTaskDefinition$.value
      ) {
        this.mobilePane = 'feedback';
      }
    });

    if (this.defaultTaskListCollapsed) {
      this.leftWidth = this.taskListCollapsedWidth;
    }

    this.taskService.taskSubmissionCompleted$.pipe(takeUntil(this.destroy$)).subscribe((task) => {
      const activeProject = this.projectSubject.value;
      const selectedTaskDefinition = this.selectedTaskDefinition$.value;
      if (
        activeProject?.id === task.project?.id &&
        selectedTaskDefinition?.id === task.definition?.id
      ) {
        this.selectedTaskDefinition$.next(null);
      }
    });

    const initialProject$ =
      this.project$ ??
      this.route.parent.data.pipe(
        map((data) => data.project as Project),
        filter((project): project is Project => !!project),
      );
    this.project$ = this.projectSubject.asObservable();
    initialProject$
      .pipe(takeUntil(this.destroy$))
      .subscribe((project) =>
        this.activateProject(
          project,
          project?.id ?? Number(this.route.parent?.snapshot.paramMap.get('projectId')),
        ),
      );

    window.dispatchEvent(new Event('resize'));
  }

  ngOnDestroy(): void {
    document.body.classList.remove('split-pane-resizing');
    this.projectLoadCancel$.next();
    this.projectLoadCancel$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  public toggleCommentsPanel(): void {
    this.commentsCollapsed = !this.commentsCollapsed;
    window.dispatchEvent(new Event('resize'));
  }

  public showMobilePane(pane: 'overview' | 'task' | 'feedback'): void {
    this.mobilePane = pane;
    this.syncSelectedTaskRoute(pane);
  }

  public clearTaskSelection(): void {
    const selectedTaskDefinition = this.selectedTaskDefinition$.value;
    if (selectedTaskDefinition && this.leftPanel) {
      // Let the task list clear both its shared selection and the task segment in the URL.
      this.leftPanel.setSelectedTaskDefinition(selectedTaskDefinition);
    } else {
      this.selectedTaskDefinition$.next(null);
    }
    this.mobilePane = 'task';
  }

  private get hasTaskRouteSelection(): boolean {
    return !!this.route.snapshot?.paramMap?.get('taskAbbreviation');
  }

  private get hasFeedbackRouteSelection(): boolean {
    return this.route.snapshot?.paramMap?.get('mobilePane') === 'feedback';
  }

  private syncSelectedTaskRoute(pane: 'overview' | 'task' | 'feedback'): void {
    const selectedTaskDefinition = this.selectedTaskDefinition$.value;
    // The dashboard is also embedded in the staff portfolio progress screen, whose task
    // destination is supplied by its host. That route has no feedback suffix and must not be
    // replaced with the student's standalone project dashboard route.
    if (this.taskSelectionUrlBase) {
      return;
    }

    const projectId =
      this.activeProjectId ?? Number(this.route.parent?.snapshot.paramMap.get('projectId'));
    if (!selectedTaskDefinition || !projectId) {
      return;
    }

    const feedbackRoute = pane === 'feedback';
    if (feedbackRoute === this.hasFeedbackRouteSelection) {
      return;
    }

    const commands: Array<string | number> = [
      '/projects',
      projectId,
      'dashboard',
      selectedTaskDefinition.abbreviation,
    ];
    if (feedbackRoute) {
      commands.push('feedback');
    }

    void this.angularRouter.navigate(commands, {replaceUrl: true});
  }

  private shouldOpenFeedback(taskDefinition: TaskDefinition): boolean {
    const task = this.projectSubject.value?.findTaskForDefinition(taskDefinition.id);
    return (
      this.hasFeedbackRouteSelection ||
      (this.hasTaskRouteSelection && (task?.numNewComments ?? 0) > 0)
    );
  }

  private activateProject(project: Project, projectId: number): void {
    if (!projectId) {
      return;
    }

    // Hosts re-emit the project they are already showing. The portfolios progress tab does it on
    // every change detection pass, and the reset below would drop the loaded project back to its
    // skeleton and close the open task each time. Activating is only for a project we are not
    // already showing or already fetching, so a repeat of the active one is left alone.
    if (projectId === this.activeProjectId) {
      return;
    }

    this.projectLoadCancel$.next();
    const activation = ++this.projectActivation;
    this.activeProjectId = projectId;
    this.projectReady = false;
    this.selectedTaskDefinition$.next(null);
    this.projectSubject.next(project);

    if (project?.unit?.id) {
      this.globalStateService.setView(ViewType.PROJECT, project);
    }

    this.loadProject(projectId, activation);
  }

  private loadProject(projectId: number, activation: number): void {
    if (!projectId) {
      return;
    }

    this.projectService
      .get(
        {id: projectId},
        {
          cacheBehaviourOnGet: 'cacheQuery',
          mappingCompleteCallback: (project: Project) => {
            if (activation === this.projectActivation && project.id === this.activeProjectId) {
              this.loadUnit(project, activation);
            }
          },
        },
      )
      .pipe(takeUntil(this.projectLoadCancel$), takeUntil(this.destroy$))
      .subscribe();
  }

  private loadUnit(project: Project, activation: number): void {
    const unitId = project.unit?.id;
    if (!unitId) {
      this.showLoadedProject(project, activation);
      return;
    }

    this.unitService
      .get(unitId)
      .pipe(takeUntil(this.projectLoadCancel$), takeUntil(this.destroy$))
      .subscribe({
        next: (unit) => {
          if (activation !== this.projectActivation || project.id !== this.activeProjectId) {
            return;
          }

          project.unit = unit;
          unit.studentCache.add(project);
          this.showLoadedProject(project, activation);
        },
        error: () => {
          this.showLoadedProject(project, activation);
        },
      });
  }

  private showLoadedProject(project: Project, activation: number): void {
    if (activation !== this.projectActivation || project.id !== this.activeProjectId) {
      return;
    }

    this.projectReady = true;
    this.globalStateService.setView(ViewType.PROJECT, project);
    this.projectSubject.next(project);
  }
}
