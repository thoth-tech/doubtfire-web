import {beforeEach, describe, expect, it, vi} from 'vitest';
import {OverlayContainer} from '@angular/cdk/overlay';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatMenuModule} from '@angular/material/menu';
import {MatSelectModule} from '@angular/material/select';
import {ActivatedRoute} from '@angular/router';
import {EMPTY} from 'rxjs';
import {Task} from 'src/app/api/models/task';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {TaskStatus} from 'src/app/api/models/task-status';
import {TaskStatusEnum} from 'src/app/api/models/task-status';
import {TaskService} from 'src/app/api/services/task.service';
import {UserService} from 'src/app/api/services/user.service';
import {ExtensionModalService} from 'src/app/common/modals/extension-modal/extension-modal.service';
import {QrModalService} from 'src/app/common/modals/qr-modal/qr-modal.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {FeedbackAppealModalService} from 'src/app/tasks/modals/feedback-appeal-modal/feedback-appeal-modal.service';
import {SubmissionTypeModalService} from 'src/app/tasks/modals/submission-type-modal/submission-type-modal.service';
import {TaskStatusCardComponent} from './task-status-card.component';

const taskServiceStub = {
  taskStatusUpdated$: EMPTY,
};
const emptyProvider = {};

describe('TaskStatusCardComponent', () => {
  let component: TaskStatusCardComponent;
  let fixture: ComponentFixture<TaskStatusCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskStatusCardComponent],
      imports: [MatButtonModule, MatCardModule, MatFormFieldModule, MatMenuModule, MatSelectModule],
      providers: [
        {provide: ExtensionModalService, useValue: emptyProvider},
        {provide: TaskService, useValue: taskServiceStub},
        {provide: ActivatedRoute, useValue: emptyProvider},
        {provide: QrModalService, useValue: emptyProvider},
        {provide: DoubtfireConstants, useValue: emptyProvider},
        {provide: SubmissionTypeModalService, useValue: emptyProvider},
        {provide: UserService, useValue: {currentUser: {systemRole: 'Student'}}},
        {provide: FeedbackAppealModalService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TaskStatusCardComponent);
    component = fixture.componentInstance;
    component.task = {
      status: 'working_on_it',
      statusLabel: () => 'Working On It',
      statusHelp: () => ({reason: 'Keep working.', action: ''}),
      blockedByPrerequisiteTasks: vi.fn().mockReturnValue(false),
      canApplyForExtension: () => false,
      inSubmittedState: () => false,
      hasSubmissionHistory: () => false,
      requiresFileUpload: () => true,
      triggerTransition: vi.fn(),
    } as unknown as Task;
    component.triggers = [
      TaskStatus.statusData('working_on_it'),
      TaskStatus.statusData('need_help'),
    ];
    fixture.detectChanges();
  });

  const combobox = (): HTMLElement => fixture.nativeElement.querySelector('[role="combobox"]');

  const accessibleLabel = (): string =>
    combobox()
      .getAttribute('aria-labelledby')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent)
      .join(' ');

  it('names the status combobox and keeps status text out of the heading list', async () => {
    expect(accessibleLabel()).toContain('Task status');
    expect(fixture.nativeElement.querySelector('h2, h5')).toBeNull();

    combobox().click();
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.querySelector('h2, h5')).toBeNull();
    const options = Array.from(overlay.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(options).toHaveLength(2);
    expect(options[1].textContent).toContain('Need Help');
    options[1].click();
    fixture.detectChanges();

    expect(component.task.triggerTransition).toHaveBeenCalledWith('need_help');
  });

  it('keeps the label available when prerequisites disable the selector', () => {
    vi.mocked(component.task.blockedByPrerequisiteTasks).mockReturnValue(true);
    fixture.detectChanges();

    expect(accessibleLabel()).toContain('Task status');
    expect(combobox().getAttribute('aria-disabled')).toBe('true');
    combobox().click();
    fixture.detectChanges();
    expect(
      TestBed.inject(OverlayContainer).getContainerElement().querySelector('[role="listbox"]'),
    ).toBeNull();
    expect(component.task.triggerTransition).not.toHaveBeenCalled();
  });

  function buildTask(status: TaskStatusEnum, requiresFiles: boolean, submissionDate?: Date): Task {
    const task = new Task();
    task.status = status;
    task.definition = {
      uploadRequirements: requiresFiles ? [{key: 'file0'}] : [],
    } as unknown as TaskDefinition;
    task.submissionDate = submissionDate;
    return task;
  }

  const previousSubmission = new Date('2026-08-31T00:00:00Z');

  it.each([
    {status: 'not_started', requiresFiles: true, submitted: undefined, first: true, again: false},
    {status: 'not_started', requiresFiles: false, submitted: undefined, first: true, again: false},
    {
      status: 'fix_and_resubmit',
      requiresFiles: true,
      submitted: previousSubmission,
      first: true,
      again: false,
    },
    {status: 'redo', requiresFiles: true, submitted: previousSubmission, first: true, again: false},
    {status: 'redo', requiresFiles: false, submitted: undefined, first: true, again: false},
    {
      status: 'working_on_it',
      requiresFiles: true,
      submitted: previousSubmission,
      first: true,
      again: false,
    },
    {
      status: 'ready_for_feedback',
      requiresFiles: true,
      submitted: previousSubmission,
      first: false,
      again: true,
    },
    {
      status: 'complete',
      requiresFiles: true,
      submitted: previousSubmission,
      first: false,
      again: true,
    },
    {status: 'complete', requiresFiles: false, submitted: undefined, first: false, again: false},
  ] as const)(
    'shows exactly one appropriate upload action for $status (uploads: $requiresFiles)',
    ({status, requiresFiles, submitted, first, again}) => {
      component.task = buildTask(status, requiresFiles, submitted);

      expect(component.showUploadSubmission).toBe(first);
      expect(component.showUploadNewFiles).toBe(again);
    },
  );

  it('offers the full submission flow again for a task returned for resubmission', () => {
    const task = buildTask('fix_and_resubmit', true, previousSubmission);
    task.definition.assessInPortfolioOnly = false;
    const triggerTransition = vi.spyOn(task, 'triggerTransition').mockResolvedValue();
    component.task = task;

    expect(component.showUploadSubmission).toBe(true);
    expect(component.showUploadNewFiles).toBe(false);
    component.uploadSubmission();

    expect(triggerTransition).toHaveBeenCalledWith('ready_for_feedback');
  });

  it('marks the replacement action pending while details or PDF processing is unresolved', () => {
    component.task = {processingPdf: true, loadingSubmissionDetails: false} as Task;
    expect(component.submissionActionPending).toBe(true);

    component.task = {processingPdf: false, loadingSubmissionDetails: true} as Task;
    expect(component.submissionActionPending).toBe(true);
  });
});
