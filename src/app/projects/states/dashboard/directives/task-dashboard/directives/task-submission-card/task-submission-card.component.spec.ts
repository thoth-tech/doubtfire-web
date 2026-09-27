import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {BehaviorSubject, of, throwError} from 'rxjs';
import {Task} from 'src/app/api/models/task';
import {TaskService} from 'src/app/api/services/task.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {AppLifecycleService} from 'src/app/common/services/app-lifecycle.service';
import {TaskSubmissionCardComponent} from './task-submission-card.component';

describe('TaskSubmissionCardComponent', () => {
  let component: TaskSubmissionCardComponent;
  let fixture: ComponentFixture<TaskSubmissionCardComponent>;
  let lifecycleState: BehaviorSubject<'active' | 'hidden'>;
  let alerts: {success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>};
  let downloadFile: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    lifecycleState = new BehaviorSubject<'active' | 'hidden'>('active');
    alerts = {success: vi.fn(), error: vi.fn()};
    downloadFile = vi.fn();

    await TestBed.configureTestingModule({
      declarations: [TaskSubmissionCardComponent],
      providers: [
        {
          provide: TaskService,
          useValue: {pdfRegeneratableStatuses: ['ready_for_feedback']},
        },
        {provide: AlertService, useValue: alerts},
        {provide: FileDownloaderService, useValue: {downloadFile}},
        {provide: AppLifecycleService, useValue: {stateSubject: lifecycleState}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(TaskSubmissionCardComponent, {set: {template: ''}})
      .compileComponents();

    fixture = TestBed.createComponent(TaskSubmissionCardComponent);
    component = fixture.componentInstance;
  });

  it('uses bounded backoff and cancels the next check when destroyed', () => {
    vi.useFakeTimers();
    const task = new Task();
    task.submissionProcessingState = 'queued';
    task.getSubmissionDetails = vi.fn(() => of(task));
    fixture.componentRef.setInput('task', task);

    fixture.detectChanges();
    expect(task.getSubmissionDetails).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    expect(task.getSubmissionDetails).toHaveBeenCalledTimes(2);

    fixture.destroy();
    vi.advanceTimersByTime(60_000);
    expect(task.getSubmissionDetails).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('pauses while hidden and refreshes immediately on normal foreground resume', () => {
    vi.useFakeTimers();
    const task = new Task();
    task.submissionProcessingState = 'processing';
    task.getSubmissionDetails = vi.fn(() => of(task));
    component.task = task;
    fixture.detectChanges();

    lifecycleState.next('hidden');
    vi.advanceTimersByTime(30_000);
    expect(task.getSubmissionDetails).toHaveBeenCalledTimes(1);

    lifecycleState.next('active');
    expect(task.getSubmissionDetails).toHaveBeenCalledTimes(2);
    fixture.destroy();
    vi.useRealTimers();
  });

  it('surfaces refresh failure as recoverable instead of continuing an endless spinner', () => {
    const task = new Task();
    task.submissionProcessingState = 'processing';
    task.getSubmissionDetails = vi.fn(() => throwError(() => new Error('offline')));
    component.task = task;

    fixture.detectChanges();

    expect(component.refreshFailed).toBe(true);
    expect(component.pollingPaused).toBe(true);
  });

  it('retries only an actionable server state and restarts polling', () => {
    vi.useFakeTimers();
    const task = new Task();
    task.submissionProcessingState = 'timed_out';
    task.submissionRetryable = true;
    task.retrySubmissionProcessing = vi.fn(() => {
      task.submissionProcessingState = 'queued';
      return of(task);
    });
    task.getSubmissionDetails = vi.fn(() => of(task));
    component.task = task;

    component.retryProcessing();

    expect(task.retrySubmissionProcessing).toHaveBeenCalledOnce();
    expect(alerts.success).toHaveBeenCalledWith('Submission processing was queued again.');
    expect(component.retryPending).toBe(false);
    vi.advanceTimersByTime(2000);
    vi.useRealTimers();
  });

  it('describes every finite processing outcome', () => {
    const task = new Task();
    component.task = task;

    task.submissionProcessingState = 'queued';
    expect(component.stateLabel).toBe('Queued');
    task.submissionProcessingState = 'processing';
    expect(component.stateLabel).toBe('Processing');
    task.submissionProcessingState = 'ready';
    expect(component.stateLabel).toBe('Ready');
    task.submissionProcessingState = 'failed';
    expect(component.stateLabel).toBe('Processing failed');
    task.submissionProcessingState = 'timed_out';
    expect(component.stateLabel).toBe('Processing timed out');
  });

  it('reopens a submitted task in its current status with new evidence enabled', () => {
    const task = new Task();
    task.status = 'ready_for_feedback';
    task.presentTaskSubmissionModal = vi.fn();
    component.task = task;

    component.uploadAlternateFiles();

    expect(task.presentTaskSubmissionModal).toHaveBeenCalledWith('ready_for_feedback', true);
  });

  it('downloads each ready artefact independently through the shared helper', () => {
    const task = new Task();
    task.definition = {abbreviation: '1.1P'} as never;
    task.submissionUrl = vi.fn(() => '/submission.pdf');
    task.submittedFilesUrl = vi.fn(() => '/submission.zip');
    component.task = task;

    component.downloadSubmission();
    component.downloadSubmissionFiles();

    expect(downloadFile).toHaveBeenNthCalledWith(1, '/submission.pdf', '1.1P.pdf');
    expect(downloadFile).toHaveBeenNthCalledWith(2, '/submission.zip', '1.1P.zip');
  });
});
