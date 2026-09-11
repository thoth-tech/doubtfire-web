import {beforeEach, describe, expect, it, vi} from 'vitest';
import {provideHttpClient} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {Task} from 'src/app/api/models/task';
import {TaskService} from '../task.service';

describe('TaskService status events', () => {
  let service: TaskService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TaskService, provideHttpClient()],
    });
    service = TestBed.inject(TaskService);
  });

  it('keeps general status changes separate from completed submissions', () => {
    const task = {} as Task;
    const statusUpdated = vi.fn();
    const submissionCompleted = vi.fn();
    service.taskStatusUpdated$.subscribe(statusUpdated);
    service.taskSubmissionCompleted$.subscribe(submissionCompleted);

    service.notifyStatusChange(task);

    expect(statusUpdated).toHaveBeenCalledOnce();
    expect(statusUpdated).toHaveBeenCalledWith(task);
    expect(submissionCompleted).not.toHaveBeenCalled();
  });

  it('broadcasts both events when a submission completes', () => {
    const task = {} as Task;
    const statusUpdated = vi.fn();
    const submissionCompleted = vi.fn();
    service.taskStatusUpdated$.subscribe(statusUpdated);
    service.taskSubmissionCompleted$.subscribe(submissionCompleted);

    service.notifyTransitionComplete(task, true);

    expect(statusUpdated).toHaveBeenCalledOnce();
    expect(statusUpdated).toHaveBeenCalledWith(task);
    expect(submissionCompleted).toHaveBeenCalledOnce();
    expect(submissionCompleted).toHaveBeenCalledWith(task);
  });

  it('does not treat a non-submission transition as a completed submission', () => {
    const task = {} as Task;
    const statusUpdated = vi.fn();
    const submissionCompleted = vi.fn();
    service.taskStatusUpdated$.subscribe(statusUpdated);
    service.taskSubmissionCompleted$.subscribe(submissionCompleted);

    service.notifyTransitionComplete(task, false);

    expect(statusUpdated).toHaveBeenCalledOnce();
    expect(statusUpdated).toHaveBeenCalledWith(task);
    expect(submissionCompleted).not.toHaveBeenCalled();
  });
});
