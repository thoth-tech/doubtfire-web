import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {Unit} from 'src/app/api/models/doubtfire-model';
import {Task} from 'src/app/api/models/task';
import {TaskService} from '../task.service';

describe('TaskService', () => {
  let service: TaskService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TaskService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TaskService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('maps has_feedback from the API to Task.hasFeedback', () => {
    const project = {
      id: 2,
      unit: undefined,
    };

    const unit = {
      id: 1,
      findStudent: vi.fn(() => project),
      taskDef: vi.fn((id: number) => ({id})),
      incorporateTasks: vi.fn(),
    } as unknown as Unit;

    project.unit = unit;

    let result: Task[];

    service.queryTasksForTaskInbox(unit).subscribe((tasks) => {
      result = tasks;
    });

    const request = httpMock.expectOne(
      (req) => req.url.endsWith('/units/1/tasks/inbox') && req.method === 'GET',
    );

    request.flush([
      {
        id: 27,
        project_id: 2,
        task_definition_id: 1,
        has_feedback: true,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].hasFeedback).toBe(true);
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
