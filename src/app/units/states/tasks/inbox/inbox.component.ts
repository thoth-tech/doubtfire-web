import { CdkDragEnd, CdkDragStart, CdkDragMove } from '@angular/cdk/drag-drop';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,          // CHANGED: implement OnDestroy for cleanup
  OnInit,
  ViewChild,
} from '@angular/core';
// CHANGED: switched from 'ng-flex-layout' to official '@angular/cdk/layout'
import { BreakpointObserver } from '@angular/cdk/layout';
// CHANGED: swapped UI-Router for Angular’s Router
import { Router }        from '@angular/router';
import {
  auditTime,
  merge,
  Observable,
  of,
  Subject,
  tap,
  withLatestFrom,
} from 'rxjs';
// CHANGED: import takeUntil to properly teardown subscriptions
import { takeUntil }     from 'rxjs/operators';
import { Task }          from 'src/app/api/models/task';
import { Unit }          from 'src/app/api/models/unit';
import { UnitRole }      from 'src/app/api/models/unit-role';
import { FileDownloaderService } from 'src/app/common/file-downloader/file-downloader.service';
import { SelectedTaskService }   from 'src/app/projects/states/dashboard/selected-task.service';
import { HotkeysService, HotkeysHelpComponent } from '@ngneat/hotkeys';
import { MatDialog }     from '@angular/material/dialog';
import { UserService }   from 'src/app/api/services/user.service';

@Component({
  selector: 'f-inbox',
  templateUrl: './inbox.component.html',
// CHANGED: point to CSS instead of SCSS after migration
  styleUrls: ['./inbox.component.css'],
})
export class InboxComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() unit!: Unit;
  @Input() unitRole!: UnitRole;
// CHANGED: relaxed taskData typing to allow extra keys if needed
  @Input() taskData!: {
    selectedTask: Task;
    [key: string]: unknown;
  };

  // CHANGED: added { static: false } for clarity, and typed ElementRef
  @ViewChild('inboxpanel', { static: false }) inboxPanel!: ElementRef<HTMLDivElement>;
  @ViewChild('commentspanel', { static: false }) commentspanel!: ElementRef<HTMLDivElement>;

  subs$: Observable<unknown>;

  private inboxStartSize$ = new Subject<number>();
  private dragMove$       = new Subject<{ event: CdkDragMove; div: HTMLDivElement }>();
  private dragMoveAudited$!: Observable<unknown>;

// CHANGED: Subject to signal unsubscription on destroy
  private destroy$ = new Subject<void>();

  public taskSelected   = false;
  public visiblePdfUrl!: string;

  get narrowTaskInbox(): boolean {
    return this.inboxPanel.nativeElement.getBoundingClientRect().width < 150;
  }

  constructor(
    private hotkeys:       HotkeysService,
    private selectedTask:  SelectedTaskService,
    public  breakpointObserver: BreakpointObserver,
    public  fileDownloader: FileDownloaderService,
// CHANGED: use Angular Router instead of UIRouter
    private router:        Router,
    public  dialog:        MatDialog,
    private userService:   UserService,
  ) {
    // CHANGED: moved subscriptions into ngOnInit with takeUntil
  }

  ngOnInit(): void {
    // CHANGED: subscribe with takeUntil for automatic cleanup
    this.selectedTask.currentPdfUrl$
      .pipe(takeUntil(this.destroy$))
      .subscribe(url => (this.visiblePdfUrl = url));

    this.selectedTask.selectedTask$
      .pipe(takeUntil(this.destroy$))
      .subscribe(task => (this.taskSelected = task != null));

    this.dragMoveAudited$ = this.dragMove$.pipe(
      withLatestFrom(this.inboxStartSize$),
      auditTime(30),
      tap(([moveEvent, startSize]: [{ event: CdkDragMove; div: HTMLDivElement }, number]) => {
        window.dispatchEvent(new Event('resize'));
        // … same resize logic …
        moveEvent.div.style.width = `${startSize + moveEvent.event.distance.x}px`;
        moveEvent.event.source.reset();
      })
    );

    this.subs$ = merge(this.dragMoveAudited$, of(true));
    window.dispatchEvent(new Event('resize'));
  }

  ngAfterViewInit(): void {
    const markers = ['Admin', 'Convenor', 'Tutor', 'Student'];
    if (markers.includes(this.userService.currentUser?.role)) {
      this.hotkeys.registerHelpModal(() => {
        const ref = this.dialog.open(HotkeysHelpComponent);
        ref.componentInstance.title = 'Formatif Marking Shortcuts';
        ref.componentInstance.dismiss.subscribe(() => ref.close());
      });
    }
  }

  // CHANGED: teardown logic to avoid memory leaks
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  startedDragging(event: CdkDragStart, div: HTMLDivElement) {
    event.source.element.nativeElement.classList.add('hovering');
    this.inboxStartSize$.next(div.getBoundingClientRect().width);
  }

  dragging(event: CdkDragMove, div: HTMLDivElement) {
    this.dragMove$.next({ event, div });
    event.source.reset();
  }

  stoppedDragging(event: CdkDragEnd, _div: HTMLDivElement) {
    event.source.element.nativeElement.classList.remove('hovering');
  }

  goToStudent(): void {
    // CHANGED: use router.navigate instead of UI-Router stateService.go
    this.router.navigate(['projects', 'dashboard'], {
      queryParams: {
        projectId: this.taskData.selectedTask.project.id,
        tutor: true,
        taskAbbr: '',
      },
    });
  }

  openPdfInNewTab(): void {
    if (this.taskData.selectedTask.hasPdf) {
      this.fileDownloader.downloadFile(
        this.visiblePdfUrl,
        `${this.taskData.selectedTask.definition.abbreviation}.pdf`
      );
    }
  }
}
