import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {Task} from '../models/task';
import {SubmissionHistoryService} from './submission-history.service';

describe('Student submission history contract', () => {
  let service: SubmissionHistoryService;
  let http: HttpTestingController;
  const task = {project: {id: 8}, definition: {id: 9}} as Task;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SubmissionHistoryService],
    });
    service = TestBed.inject(SubmissionHistoryService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('keeps processing and explicit availability from the student response', () => {
    service.queryStudentHistory(task).subscribe((result) => {
      expect(result.processing).toBe(true);
      expect(result.versions[0]).toEqual({
        id: 3,
        versionOrder: 1,
        timestamp: new Date(1750000000000),
        current: true,
        available: true,
      });
      expect(result.versions[1].available).toBe(false);
      expect(result.versions[1].timestamp).toBeNull();
    });
    http
      .expectOne((request) =>
        request.url.endsWith('/projects/8/task_def_id/9/submission_histories'),
      )
      .flush(
        [
          {
            id: 3,
            version_order: 1,
            submission_timestamp: '1750000000',
            current: true,
            status: 'available',
          },
          {id: 2, version_order: 2, submission_timestamp: 'legacy', status: 'unavailable'},
        ],
        {status: 202, statusText: 'Accepted'},
      );
  });

  it('does not infer permission from an absent availability flag', () => {
    service
      .queryStudentHistory(task)
      .subscribe((result) => expect(result.versions[0].available).toBe(false));
    http
      .expectOne((request) => request.url.includes('/submission_histories'))
      .flush([{id: 1, submission_timestamp: '1750000000'}]);
    expect(service.studentArchiveUrl(task, 3)).toContain(
      '/projects/8/task_def_id/9/submission_histories/3/files',
    );
  });
});
