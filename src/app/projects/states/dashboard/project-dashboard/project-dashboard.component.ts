/* eslint-disable @typescript-eslint/no-explicit-any */
import {CdkDragEnd, CdkDragMove, CdkDragStart} from '@angular/cdk/drag-drop';
import {Component, Input, ViewChild, type OnInit} from '@angular/core';
import {Observable, Subject, auditTime, merge, of, tap, withLatestFrom} from 'rxjs';
import {ProjectService} from 'src/app/api/services/project.service';
import {GlobalStateService} from '../../index/global-state.service';
import {UserService} from 'src/app/api/services/user.service';
import {Project, TaskDefinition} from 'src/app/api/models/doubtfire-model';
import { FUnitTaskListComponent } from 'src/app/units/states/tasks/viewer/directives/f-unit-task-list/f-unit-task-list.component';
import { outputToObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'f-project-dashboard',
  templateUrl: './project-dashboard.component.html',
  styleUrl: './project-dashboard.component.css',
})
export class ProjectDashboardComponent implements OnInit {
  @Input() public project$: Observable<Project>;

  /**
   * Reference to the unit task list component so that we can create an
   * observer of the selected task definition.
   */
  private unitTaskListPlaceholder: FUnitTaskListComponent;

  @ViewChild('unitTaskList') set unitTaskList(content: FUnitTaskListComponent) {
    if (content) {
      // initially setter gets called with undefined
      this.unitTaskListPlaceholder = content;
      this.selectedTaskDefinition$ = outputToObservable(this.unitTaskListPlaceholder.selectedTaskDefinition);

      // Triger event for first selected task? -- not a behaviour subject? How can we avoid this?
      setTimeout(() => {
        this.unitTaskListPlaceholder.selectedTaskDefinition.emit(this.unitTaskListPlaceholder.selectedTaskDef);
      });
    }
  }

  /**
   * The currently selected task definition - selected in the unit task list.
   */
  public selectedTaskDefinition$: Observable<TaskDefinition>;

  subs$: Observable<unknown>;

  private leftComponentStartSize$ = new Subject<number>();
  private dragMove$ = new Subject<{event: CdkDragMove; div: HTMLDivElement}>();
  private dragMoveAudited$;


  projectTasks = [];

  constructor(
    private currentUser: UserService,
    private projectService: ProjectService,
    private globalStateService: GlobalStateService,
  ) {}

  startedDragging(event: CdkDragStart, div: HTMLDivElement) {
    event.source.element.nativeElement.classList.add('hovering');
    const w = div.getBoundingClientRect().width;
    this.leftComponentStartSize$.next(w);
  }

  dragging(event: CdkDragMove, div: HTMLDivElement) {
    this.dragMove$.next({event, div});
    event.source.reset();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stoppedDragging(event: CdkDragEnd, _div: HTMLDivElement) {
    event.source.element.nativeElement.classList.remove('hovering');
  }

  ngOnInit(): void {
    // projectTasks = this.projectService.loadProject
    this.project$.subscribe((project) => {
      console.log(project);
    });

    this.dragMoveAudited$ = this.dragMove$.pipe(
      withLatestFrom(this.leftComponentStartSize$),
      auditTime(30),
      tap(([moveEvent, startSize]) => {
        window.dispatchEvent(new Event('resize'));

        let newWidth: number;
        let width: number;
        if (moveEvent.div.id === 'inboxpanel') {
          newWidth = startSize + moveEvent.event.distance.x;

          // if width is belo 250, snap to 50px
          if (newWidth < 250 && newWidth > 100) {
            width = 250;
          } else if (newWidth < 150) {
            width = 50;
          } else {
            width = Math.min(newWidth, 500);
          }
        } else {
          newWidth = startSize - moveEvent.event.distance.x;
          width = Math.min(Math.max(newWidth, 250), 500);
        }
        moveEvent.div.style.width = `${width}px`;
        moveEvent.event.source.reset();
      }),
    );
    this.subs$ = merge(this.dragMoveAudited$, of(true));
    window.dispatchEvent(new Event('resize'));
  }
}
