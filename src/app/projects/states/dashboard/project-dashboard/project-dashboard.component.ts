/* eslint-disable @typescript-eslint/no-explicit-any */
import {CdkDragEnd, CdkDragMove, CdkDragStart} from '@angular/cdk/drag-drop';
import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input, type OnInit} from '@angular/core';
import {Observable, Subject, auditTime, merge, of, tap, withLatestFrom} from 'rxjs';
import {ProjectService} from 'src/app/api/services/project.service';
import {GlobalStateService} from '../../index/global-state.service';
import {UserService} from 'src/app/api/services/user.service';

@Component({
  selector: 'f-project-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './project-dashboard.component.html',
  styleUrl: './project-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDashboardComponent implements OnInit {
  @Input() leftComponent: any;
  @Input() centerComponent: any;
  @Input() rightComponent: any;
  @Input() footerComponent: any;

  subs$: Observable<unknown>;

  private leftComponentStartSize$ = new Subject<number>();
  private dragMove$ = new Subject<{event: CdkDragMove; div: HTMLDivElement}>();
  private dragMoveAudited$;

  projectTasks = [];

  constructor(
    private currentUser: UserService,
    private projectService: ProjectService,
    private globalStateService: GlobalStateService,
  ) {
    console.log('test');
  }

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
    console.log('test');
    // projectTasks = this.projectService.loadProject

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
