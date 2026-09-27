import {HotkeysService} from '@ngneat/hotkeys';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {BreakpointObserver} from '@angular/cdk/layout';
import {CommonModule} from '@angular/common';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {MatMenuModule} from '@angular/material/menu';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatTooltipModule} from '@angular/material/tooltip';
import {By} from '@angular/platform-browser';
import {Router} from '@angular/router';
import {BehaviorSubject, of} from 'rxjs';
import {Task} from 'src/app/api/models/task';
import {TaskStatus} from 'src/app/api/models/task-status';
import {ProjectService} from 'src/app/api/services/project.service';
import {TaskService} from 'src/app/api/services/task.service';
import {UserService} from 'src/app/api/services/user.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {FooterComponent} from 'src/app/common/footer/footer.component';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {DiscussedInClassReasonModalService} from 'src/app/common/modals/discussed-in-class-reason-modal/discussed-in-class-reason-modal.service';
import {TaskAssessmentModalService} from 'src/app/common/modals/task-assessment-modal/task-assessment-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {SelectedTaskService} from 'src/app/projects/states/dashboard/selected-task.service';
import {TaskClaimComponent} from './directives/task-claim/task-claim.component';
import {InboxComponent} from './inbox.component';

describe('Inbox phone assessment actions', () => {
  let fixture: ComponentFixture<InboxComponent>;
  let selectedTask: BehaviorSubject<Task>;
  let mobile: boolean;
  let claimTask: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mobile = true;
    claimTask = vi.fn(() => of({}));
    selectedTask = new BehaviorSubject<Task>({
      definition: {abbreviation: '1.1P', name: 'Demonstration', assessInPortfolioOnly: false},
      project: {student: {nickname: 'Alex', displayName: 'Alex Student'}, taskStats: []},
      unit: {staff: [{id: 10, user: {id: 1}}]},
      suggestedTaskStatus: 'complete',
      status: 'ready_for_feedback',
      canMarkComplete: true,
      claimedByUnitRoleId: null,
      updateTaskStatus: vi.fn(),
    } as unknown as Task);

    await TestBed.configureTestingModule({
      declarations: [InboxComponent, FooterComponent, TaskClaimComponent],
      imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatToolbarModule,
        MatTooltipModule,
      ],
      providers: [
        {
          provide: BreakpointObserver,
          useValue: {isMatched: () => mobile, observe: () => of({matches: true})},
        },
        {
          provide: SelectedTaskService,
          useValue: {selectedTask$: selectedTask, currentPdfUrl$: of(null)},
        },
        {
          provide: HotkeysService,
          useValue: {
            getHotkeys: () =>
              ['shift.?', 'control.shift.f', 'control.shift.c', 'control.shift.d'].map((keys) => ({
                keys,
              })),
            removeShortcuts: vi.fn(),
          },
        },
        {provide: TaskService, useValue: {statusData: TaskStatus.statusData, claimTask}},
        {provide: UserService, useValue: {currentUser: {id: 1}}},
        {provide: AlertService, useValue: {success: vi.fn(), error: vi.fn()}},
        {provide: MatSnackBar, useValue: {open: vi.fn()}},
        ...[
          Router,
          MatDialog,
          FileDownloaderService,
          DoubtfireConstants,
          ProjectService,
          ConfirmationModalService,
          DiscussedInClassReasonModalService,
          TaskAssessmentModalService,
        ].map((provide) => ({provide, useValue: {}})),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(InboxComponent);
    fixture.componentInstance.taskData = {
      selectedTask: selectedTask.value,
      source: () => of([]),
      taskKey: null,
      onSelectedTaskChange: () => {},
      taskDefMode: false,
    };
    fixture.componentInstance.viewType = 'inbox';
    fixture.detectChanges();
  });

  const footer = (): HTMLElement => fixture.nativeElement.querySelector('f-footer');
  const complete = (): HTMLButtonElement =>
    footer().querySelector('[aria-label="Mark as Complete"]');

  it('renders the real footer below the phone submission with named status actions', () => {
    expect(footer()).not.toBeNull();
    expect(footer().getAttribute('role')).toBe('region');
    expect(footer().getAttribute('aria-label')).toBe('Assessment actions for 1.1P, Alex Student');
    expect(footer().parentElement.lastElementChild).toBe(footer());
    expect(footer().parentElement.hidden).toBe(false);
    expect(footer().querySelector('.footer-assessment')).not.toBeNull();
    expect(footer().querySelector('.footer-utilities')).not.toBeNull();
    expect(complete().disabled).toBe(false);
    complete().click();
    expect(selectedTask.value.updateTaskStatus).toHaveBeenCalledExactlyOnceWith('complete');
  });

  it('names phone assessment actions when the optional display name is absent', () => {
    Object.assign(selectedTask.value.project.student, {
      displayName: undefined,
      name: 'Alex Student',
    });
    fixture.detectChanges();

    expect(footer().getAttribute('aria-label')).toBe('Assessment actions for 1.1P, Alex Student');
  });

  it('uses a meaningful region name before a task is selected', () => {
    selectedTask.next(null);
    fixture.componentInstance.taskData.selectedTask = null;
    fixture.detectChanges();

    expect(footer().getAttribute('aria-label')).toBe('Assessment actions');
    expect(footer().querySelector('f-user-badge')).toBeNull();
    expect(footer().querySelector('f-project-progress-bar')).toBeNull();
  });

  it('uses the existing claim action and retains the same claim and completion guards', () => {
    fixture.componentInstance.viewType = 'overflow';
    fixture.detectChanges();
    expect(complete().disabled).toBe(true);
    const claim: HTMLButtonElement = footer().querySelector('f-task-claim button');
    expect(claim.textContent).toContain('Claim task');
    claim.click();
    fixture.detectChanges();

    expect(claimTask).toHaveBeenCalledExactlyOnceWith(selectedTask.value);
    expect(claim.textContent).toContain('Claimed by you');
    expect(complete().disabled).toBe(false);

    Object.assign(selectedTask.value, {canMarkComplete: false});
    fixture.detectChanges();
    expect(complete().disabled).toBe(true);
    Object.assign(selectedTask.value, {canMarkComplete: true});
    selectedTask.value.claimedByUnitRoleId = 20;
    fixture.detectChanges();
    expect(complete().disabled).toBe(true);
    expect(claim.textContent).toContain('Claimed by another tutor');
    expect(selectedTask.value.updateTaskStatus).not.toHaveBeenCalled();
  });

  it('hides the actions with the submission when returning to the phone inbox list', () => {
    fixture.nativeElement.querySelector('[aria-label="Back to the task list"]').click();
    fixture.detectChanges();
    expect(footer().parentElement.hidden).toBe(true);
    expect(fixture.nativeElement.querySelector('#inboxpanel').hidden).toBe(false);
  });

  it('keeps one footer and passes the view type through when crossing the phone breakpoint', () => {
    mobile = false;
    fixture.componentInstance.viewType = 'explorer';
    fixture.detectChanges();
    const footers = fixture.debugElement.queryAll(By.directive(FooterComponent));
    expect(footers).toHaveLength(1);
    expect(footers[0].componentInstance.viewType).toBe('explorer');
    expect(fixture.nativeElement.querySelector('[aria-label="Back to the task list"]')).toBeNull();
  });
});
