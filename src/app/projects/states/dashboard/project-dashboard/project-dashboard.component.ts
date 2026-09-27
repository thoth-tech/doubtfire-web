import {environment} from 'src/environments/environment';
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
  isDevMode,
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {BehaviorSubject, Observable, Subject, filter, map, takeUntil} from 'rxjs';
import {
  Project,
  TaskDefinition,
  TaskStatus,
  TaskStatusEnum,
} from 'src/app/api/models/doubtfire-model';
import {NotificationFeedbackRouteIntentService} from 'src/app/api/services/notification-feedback-route-intent.service';
import {ProjectService} from 'src/app/api/services/project.service';
import {TaskService} from 'src/app/api/services/task.service';
import {UnitService} from 'src/app/api/services/unit.service';
import {UserService} from 'src/app/api/services/user.service';
import {MilestoneCelebrationService} from 'src/app/common/celebrate/milestone-celebration.service';
import {PanelComponent} from 'src/app/common/panel-layout/panel.component';
import {ConversationLandingService} from 'src/app/tasks/task-comments-viewer/conversation-landing.service';
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
  @ViewChild('taskListPanel') private taskListPanel?: PanelComponent;

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

  readonly skeletonRows = Array.from({length: 10}, (_, index) => index);
  private readonly projectSubject: BehaviorSubject<Project> = new BehaviorSubject(null);

  private readonly destroy$: Subject<void> = new Subject();
  private readonly projectLoadCancel$: Subject<void> = new Subject();
  private projectReady = false;
  // Set when the project itself could not be loaded (a wrong or stale link, no
  // access, or no connection). Without it the page stayed on its skeleton forever.
  public projectLoadFailed = false;
  private activeProjectId: number | null = null;
  private projectActivation = 0;

  projectTasks = [];

  private milestoneCheckedProjectId: number | null = null;
  private destroyed = false;

  constructor(
    private currentUser: UserService,
    private projectService: ProjectService,
    private taskService: TaskService,
    private unitService: UnitService,
    private globalStateService: GlobalStateService,
    private route: ActivatedRoute,
    private breakpointObserver: BreakpointObserver,
    private angularRouter: Router,
    private notificationFeedbackIntents?: NotificationFeedbackRouteIntentService,
    private conversationLanding?: ConversationLandingService,
    private milestones?: MilestoneCelebrationService,
  ) {}

  /**
   * The narrowest each desktop panel goes. The task column needs room for its tab bar,
   * a four-date timeline and a row of action buttons; below these the layout rails the
   * list, then comments, instead of squeezing.
   */
  public readonly panelMinWidths = {list: 280, task: 420, comments: 320} as const;
  public readonly taskListCollapsedWidth = 75;
  public readonly taskListExpandedWidth = 400;
  public readonly taskListCollapseThreshold = 125;
  private _leftWidth = this.taskListExpandedWidth;
  // Desktop only: the panel shown full screen (the chat, so a long conversation has
  // room), and the one shown when the panels stack. Esc or the same button puts it back.
  public fullscreenPanel: string | null = null;
  public activePanel: string | null = 'list';
  public isPhoneLayout = false;
  public mobilePane: 'overview' | 'task' | 'feedback' = 'task';
  public activeTaskStatusFilter: TaskStatusEnum | null = null;
  private taskFilterNavigationActive = false;

  private readonly phoneBreakpoint = '(max-width: 639.98px)';

  /** The staff portfolio view embeds this page, and remembers its panels apart. */
  public get panelPage(): string {
    return this.taskSelectionUrlBase ? 'portfolio-progress' : 'project-dashboard';
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

  ngOnInit(): void {
    this.breakpointObserver
      .observe(this.phoneBreakpoint)
      .pipe(takeUntil(this.destroy$))
      .subscribe(({matches}) => {
        this.isPhoneLayout = matches;
        if (matches) {
          // The phone layout has its own feedback pane and no full-screen mode.
          this.fullscreenPanel = null;
        }
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
        this.activePanel = 'list';
        this.fullscreenPanel = null;
        return;
      }

      this.activePanel = 'task';

      if (this.isPhoneLayout) {
        // A task opened from a notification/deep link should expose its feedback immediately.
        // A task chosen from the list is selected before its route is updated, so it starts on
        // the task pane instead.
        this.mobilePane = this.shouldOpenFeedback(taskDefinition) ? 'feedback' : 'task';
      }

      this.forwardNotificationLanding(taskDefinition);
    });

    this.notificationFeedbackIntents?.requests$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.forwardNotificationLanding(this.selectedTaskDefinition$.value));

    this.route.paramMap?.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      if (
        this.isPhoneLayout &&
        params.get('mobilePane') === 'feedback' &&
        this.selectedTaskDefinition$.value
      ) {
        this.mobilePane = 'feedback';
      }
    });

    this.route.queryParamMap?.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const requestedStatus = params.get('taskStatus');
      const nextStatus = TaskStatus.isStatus(requestedStatus) ? requestedStatus : null;
      const nextTaskFilterNavigation = params.get('taskView') === 'tasks' || !!nextStatus;
      if (
        nextStatus === this.activeTaskStatusFilter &&
        nextTaskFilterNavigation === this.taskFilterNavigationActive
      ) {
        return;
      }

      const wasTaskFilterNavigation = this.taskFilterNavigationActive;
      this.activeTaskStatusFilter = nextStatus;
      this.taskFilterNavigationActive = nextTaskFilterNavigation;
      if (nextTaskFilterNavigation) {
        // Overview cards navigate to the canonical dashboard route with this query
        // parameter. Query-only route reuse must still expose the task list rather
        // than leaving the phone on the overview or stale task pane.
        this.selectedTaskDefinition$.next(null);
        this.mobilePane = 'task';
        this.revealTaskList();
      } else if (wasTaskFilterNavigation) {
        // The companion view marker lets browser Back restore the Overview pane,
        // while a user-cleared status retains taskView=tasks and stays in Tasks.
        this.mobilePane = 'overview';
      }
    });

    this.taskService.taskSubmissionCompleted$.pipe(takeUntil(this.destroy$)).subscribe((task) => {
      const activeProject = this.projectSubject.value;
      const selectedTaskDefinition = this.selectedTaskDefinition$.value;
      if (
        activeProject?.id === task.project?.id &&
        selectedTaskDefinition?.id === task.definition?.id
      ) {
        // A successful upload belongs to the task the student was working on.
        // Keep that exact selection while TaskDashboard exposes its queued or
        // ready submission state; returning to the generic list loses context.
        this.mobilePane = 'task';
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

  /**
   * A status card filters the task list, so open that list if it is collapsed or
   * railed for space. Deferred a tick so it also works on first load, before the
   * panel exists.
   */
  private revealTaskList(): void {
    setTimeout(() => this.taskListPanel?.expandFromRail());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.projectLoadCancel$.next();
    this.projectLoadCancel$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  public showMobilePane(pane: 'overview' | 'task' | 'feedback'): void {
    this.mobilePane = pane;
    if (pane === 'overview' && this.taskFilterNavigationActive) {
      void this.angularRouter.navigate([], {
        relativeTo: this.route,
        queryParams: {taskStatus: null, taskView: null},
        queryParamsHandling: 'merge',
      });
    }
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

    void this.angularRouter.navigate(commands, {
      replaceUrl: true,
      queryParamsHandling: 'preserve',
    });
  }

  private shouldOpenFeedback(taskDefinition: TaskDefinition): boolean {
    const task = this.projectSubject.value?.findTaskForDefinition(taskDefinition.id);
    return (
      this.hasFeedbackRouteSelection ||
      (this.hasTaskRouteSelection && (task?.numNewComments ?? 0) > 0)
    );
  }

  private forwardNotificationLanding(taskDefinition: TaskDefinition | null): void {
    if (!taskDefinition || !this.notificationFeedbackIntents || !this.conversationLanding) {
      return;
    }

    const projectId =
      this.activeProjectId ?? Number(this.route.parent?.snapshot.paramMap.get('projectId'));
    if (!projectId) {
      return;
    }

    const intent = this.notificationFeedbackIntents.consume({
      projectId,
      taskAbbreviation: taskDefinition.abbreviation,
    });
    if (!intent) {
      return;
    }

    this.conversationLanding.requestLatestMessages({
      projectId,
      taskDefinitionId: taskDefinition.id,
    });
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
    this.projectLoadFailed = false;
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
      .subscribe({
        error: () => {
          if (activation === this.projectActivation) {
            this.projectLoadFailed = true;
          }
        },
      });
  }

  public retryProjectLoad(): void {
    if (!this.activeProjectId) {
      return;
    }

    this.projectLoadCancel$.next();
    this.projectLoadFailed = false;
    this.loadProject(this.activeProjectId, ++this.projectActivation);
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
    this.checkMilestones(project);
  }

  /**
   * Once per opened project, shows the signed off dialog when tasks became complete
   * since the student last looked. The staff portfolio view embeds this page and
   * never checks. The service itself also refuses anyone who is not the student.
   */
  private checkMilestones(project: Project): void {
    if (
      !this.milestones ||
      this.taskSelectionUrlBase ||
      this.milestoneCheckedProjectId === project.id
    ) {
      return;
    }
    this.milestoneCheckedProjectId = project.id;

    void this.milestones
      .checkProject(project, {preview: this.milestonePreviewRequested()})
      .then((result) => {
        if (result !== 'view' || this.destroyed || this.activeProjectId !== project.id) {
          return;
        }

        void this.angularRouter.navigate([], {
          relativeTo: this.route,
          queryParams: {taskStatus: 'complete', taskView: 'tasks'},
          queryParamsHandling: 'merge',
        });
      })
      .catch(() => undefined);
  }

  /** `?celebrate=preview` replays the dialog locally. A production build ignores it. */
  private milestonePreviewRequested(): boolean {
    return (
      isDevMode() &&
      environment.production === false &&
      this.route.snapshot?.queryParamMap?.get('celebrate') === 'preview'
    );
  }
}
