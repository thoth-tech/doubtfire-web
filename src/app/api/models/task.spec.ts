import {beforeEach, describe, expect, it} from 'vitest';
import {HttpClient} from '@angular/common/http';
import {of} from 'rxjs';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {provideAppInjectorForTests} from 'src/app/testing/app-injector-stub';
import {Project} from './project';
import {SubmissionProcessingResponse, Task} from './task';
import {TaskDefinition} from './task-definition';

function taskWithUploads(uploads: number = 1): Task {
  const task = new Task();
  task.definition = {
    id: 2,
    uploadRequirements: Array.from({length: uploads}, (_, i) => ({key: `file${i}`})),
  } as unknown as TaskDefinition;
  return task;
}

describe('Task submission history', () => {
  it('distinguishes a first submission from current and returned submission states', () => {
    const task = taskWithUploads();
    task.status = 'not_started';
    expect(task.hasSubmissionHistory()).toBe(false);

    task.status = 'ready_for_feedback';
    expect(task.hasSubmissionHistory()).toBe(true);

    task.status = 'redo';
    expect(task.hasSubmissionHistory()).toBe(true);
  });

  it('retains history while status changes when a timestamp or artifact exists', () => {
    const task = taskWithUploads();
    task.status = 'working_on_it';

    task.submissionDate = new Date('2026-08-31T00:00:00Z');
    expect(task.hasSubmissionHistory()).toBe(true);

    task.submissionDate = undefined;
    task.hasPdf = true;
    expect(task.hasSubmissionHistory()).toBe(true);

    task.hasPdf = false;
    task.processingPdf = true;
    expect(task.hasSubmissionHistory()).toBe(true);

    task.processingPdf = false;
    task.submissionProcessingState = 'failed';
    expect(task.hasSubmissionHistory()).toBe(true);
  });

  it('does not treat an invalid submission date as history', () => {
    const task = taskWithUploads();
    task.status = 'working_on_it';
    task.submissionDate = new Date(Number.NaN);

    expect(task.hasSubmissionHistory()).toBe(false);
  });

  it.each(['complete', 'ready_for_feedback', 'redo'] as const)(
    'has no submission history in %s when the task takes no uploads',
    (status) => {
      const task = taskWithUploads(0);
      task.status = status;
      task.submissionDate = new Date('2026-08-31T00:00:00Z');

      expect(task.hasSubmissionHistory()).toBe(false);
    },
  );
});

describe('Task submission details', () => {
  let response: SubmissionProcessingResponse;

  beforeEach(() => {
    provideAppInjectorForTests([
      [HttpClient, {get: () => of(response)}],
      [DoubtfireConstants, {API_URL: 'http://localhost:3000/api'}],
    ]);
  });

  function loadDetails(task: Task): Task {
    let loaded: Task;
    task.getSubmissionDetails().subscribe((result) => {
      loaded = result;
    });
    return loaded;
  }

  function unsubmittedTask(): Task {
    const task = taskWithUploads();
    const project = new Project();
    project.id = 1;
    task.project = project;
    task.status = 'not_started';
    return task;
  }

  it.each([
    {
      shape: 'an existing task that was never submitted',
      details: {
        has_pdf: false,
        pdf_ready: false,
        submission_files_ready: false,
        processing_pdf: false,
        processing_state: 'not_submitted',
        submission_date: null,
        task_status: 'not_started',
      } as SubmissionProcessingResponse,
    },
    {
      shape: 'a task with no submission date key',
      details: {
        has_pdf: false,
        pdf_ready: false,
        submission_files_ready: false,
        processing_pdf: false,
        processing_state: 'not_submitted',
      } as SubmissionProcessingResponse,
    },
  ])('keeps no submission history after loading details for $shape', ({details}) => {
    const task = unsubmittedTask();
    expect(task.hasSubmissionHistory()).toBe(false);

    response = details;
    loadDetails(task);

    expect(task.hasSubmissionHistory()).toBe(false);
    expect(task.submissionDate).toBeUndefined();
  });

  it('maps a real submission date from the details response', () => {
    const task = unsubmittedTask();
    task.status = 'working_on_it';

    response = {
      processing_state: 'ready',
      has_pdf: true,
      submission_date: '2026-08-31T00:00:00.000Z',
    };
    loadDetails(task);

    expect(task.submissionDate?.toISOString()).toBe('2026-08-31T00:00:00.000Z');
    expect(task.hasSubmissionHistory()).toBe(true);
  });

  it('keeps the loaded submission date when the details response leaves the key out', () => {
    const task = unsubmittedTask();
    task.submissionDate = new Date('2026-08-31T00:00:00.000Z');

    response = {processing_state: 'not_submitted'};
    loadDetails(task);

    expect(task.submissionDate?.toISOString()).toBe('2026-08-31T00:00:00.000Z');
  });
});
