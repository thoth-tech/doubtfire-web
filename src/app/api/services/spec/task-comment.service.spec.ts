import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  HttpEventType,
  HttpRequest,
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {Task, TaskComment} from 'src/app/api/models/doubtfire-model';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {EmojiService} from 'src/app/common/services/emoji.service';
import {AuthenticationService} from '../authentication.service';
import {NotificationService} from '../notification.service';
import {TaskCommentService} from '../task-comment.service';
import {TestAttemptService} from '../test-attempt.service';
import {UserService} from '../user.service';

describe('TaskCommentService discussion comments', () => {
  let taskCommentService: TaskCommentService;
  let httpMock: HttpTestingController;
  let downloader: {
    downloadFile: ReturnType<typeof vi.fn>;
    downloadFileWithFeedback: ReturnType<typeof vi.fn>;
  };
  let notificationService: NotificationService;
  let isAuthenticated: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    downloader = {downloadFile: vi.fn(), downloadFileWithFeedback: vi.fn()};
    isAuthenticated = vi.fn().mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [
        TaskCommentService,
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        {provide: AuthenticationService, useValue: {isAuthenticated}},
        {provide: EmojiService, useValue: {}},
        {provide: UserService, useValue: {cache: {getOrCreate: () => ({})}}},
        {provide: FileDownloaderService, useValue: downloader},
        {provide: TestAttemptService, useValue: {cache: {getOrCreate: () => ({})}}},
      ],
    });

    taskCommentService = TestBed.inject(TaskCommentService);
    httpMock = TestBed.inject(HttpTestingController);
    notificationService = TestBed.inject(NotificationService);
  });

  it('refreshes the bell once after reading comments and uses the server count', () => {
    const counts: number[] = [];
    const subscription = notificationService.unreadCount$.subscribe((count) => counts.push(count));
    notificationService.refreshUnreadCount().subscribe();
    httpMock.expectOne('http://localhost:3000/api/notifications/unread_count').flush({count: 5});

    const task = {numNewComments: 2} as Task;
    let comments: TaskComment[];
    taskCommentService.query({projectId: 1, taskDefinitionId: 2}, task).subscribe((result) => {
      comments = result;
    });
    httpMock.expectOne('http://localhost:3000/api/projects/1/task_def_id/2/comments/').flush([]);

    expect(comments).toEqual([]);
    expect(task.numNewComments).toBe(0);
    httpMock.expectOne('http://localhost:3000/api/notifications/unread_count').flush({count: 3});
    expect(counts).toEqual([0, 5, 3]);
    subscription.unsubscribe();
  });

  it('does not request an unread count for a signed-out user', () => {
    isAuthenticated.mockReturnValue(false);
    const task = {numNewComments: 2} as Task;
    taskCommentService.query({projectId: 1, taskDefinitionId: 2}, task).subscribe();
    httpMock.expectOne('http://localhost:3000/api/projects/1/task_def_id/2/comments/').flush([]);

    expect(task.numNewComments).toBe(0);
    httpMock.expectNone('http://localhost:3000/api/notifications/unread_count');
  });

  it('still returns comments when the badge refresh fails', () => {
    const task = {numNewComments: 2} as Task;
    const next = vi.fn();
    const error = vi.fn();
    taskCommentService.query({projectId: 1, taskDefinitionId: 2}, task).subscribe({next, error});
    httpMock.expectOne('http://localhost:3000/api/projects/1/task_def_id/2/comments/').flush([]);
    httpMock.expectOne('http://localhost:3000/api/notifications/unread_count').flush(null, {
      status: 503,
      statusText: 'Service Unavailable',
    });

    expect(next).toHaveBeenCalledWith([]);
    expect(error).not.toHaveBeenCalled();
  });

  it('does not refresh the badge or clear unread comments when comments fail to load', () => {
    const task = {numNewComments: 2} as Task;
    const error = vi.fn();
    taskCommentService.query({projectId: 1, taskDefinitionId: 2}, task).subscribe({error});
    httpMock.expectOne('http://localhost:3000/api/projects/1/task_def_id/2/comments/').flush(null, {
      status: 503,
      statusText: 'Service Unavailable',
    });

    expect(error).toHaveBeenCalledOnce();
    expect(task.numNewComments).toBe(2);
    httpMock.expectNone('http://localhost:3000/api/notifications/unread_count');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads attachment guidance from the authenticated API policy endpoint', () => {
    let received: unknown;
    taskCommentService.attachmentPolicy().subscribe((policy) => {
      received = policy;
    });
    const request = httpMock.expectOne('http://localhost:3000/api/task_comments/upload_policy');
    expect(request.request.method).toBe('GET');
    const policy = {
      version: 1,
      max_bytes_exclusive: 30_000_000,
      max_selection_count: 5,
      categories: [],
    };
    request.flush(policy);
    expect(received).toEqual(policy);
  });

  it('uses the authenticated downloader and forces attachment disposition for generic files', () => {
    taskCommentService.downloadAttachment({
      id: 1,
      attachmentFileName: 'results.xlsx',
      attachmentUrl:
        'http://localhost:3000/api/projects/1/task_def_id/2/comments/1?as_attachment=false',
    } as TaskComment);
    expect(TestBed.inject(FileDownloaderService).downloadFile).toHaveBeenCalledWith(
      'http://localhost:3000/api/projects/1/task_def_id/2/comments/1?as_attachment=true',
      'results.xlsx',
    );
  });

  it('posts a discussion reply without expecting an entity response', () => {
    const replyAudio = new Blob(['reply audio'], {type: 'audio/webm'});
    const comment = {
      id: 69,
      project: {id: 1},
      task: {definition: {id: 2}},
    } as TaskComment;
    let completed = false;

    taskCommentService.postDiscussionReply(comment, replyAudio).subscribe(() => {
      completed = true;
    });

    const req = httpMock.expectOne((request: HttpRequest<FormData>): boolean => {
      expect(request.url).toEqual(
        'http://localhost:3000/api/projects/1/task_def_id/2/comments/69/discussion_comment/reply',
      );
      expect(request.method).toBe('POST');
      expect(request.body instanceof FormData).toBe(true);
      const attachment = request.body.get('attachment') as Blob;
      expect(attachment instanceof Blob).toBe(true);
      expect(attachment.size).toBe(replyAudio.size);
      expect(attachment.type).toBe(replyAudio.type);
      return true;
    });

    req.flush(null);

    expect(completed).toBe(true);
  });

  it('uploads a staged attachment with its filename and stable request id but no empty caption', () => {
    const attachment = new Blob(['document bytes'], {type: 'application/pdf'});
    const refreshCommentData = vi.fn();
    const task = {
      project: {id: 12},
      definition: {id: 34},
      refreshCommentData,
    } as never;
    const states: Array<{state: string; progress: number}> = [];

    taskCommentService
      .uploadStagedAttachment(
        task,
        attachment,
        'Feedback <draft>.pdf',
        '',
        null,
        'stable-request-123',
      )
      .subscribe((state) => states.push(state));

    const req = httpMock.expectOne('http://localhost:3000/api/projects/12/task_def_id/34/comments');
    expect(req.request.method).toBe('POST');
    const formData = req.request.body as FormData;
    const uploaded = formData.get('attachment') as File;
    expect(uploaded.name).toBe('Feedback <draft>.pdf');
    expect(uploaded.type).toBe('application/pdf');
    expect(formData.get('comment')).toBeNull();
    expect(formData.get('reply_to_id')).toBeNull();
    expect(formData.get('client_request_id')).toBe('stable-request-123');

    req.event({type: HttpEventType.UploadProgress, loaded: 5, total: 10});
    req.flush({id: 99});

    expect(states).toEqual([
      {state: 'progress', progress: 50},
      {state: 'complete', progress: 100},
    ]);
    expect(refreshCommentData).toHaveBeenCalledOnce();
  });

  it('uses the shared download feedback lifecycle for a feedback attachment', () => {
    const comment = {
      id: 77,
      attachmentUrl: 'http://localhost:3000/api/comments/77?as_attachment=false',
      attachmentFileName: 'Tutor feedback.docx',
    } as TaskComment;

    taskCommentService.downloadCommentAttachment(comment);

    expect(downloader.downloadFileWithFeedback).toHaveBeenCalledOnce();
    expect(downloader.downloadFileWithFeedback).toHaveBeenCalledWith(
      'http://localhost:3000/api/comments/77?as_attachment=true',
      'Tutor feedback.docx',
      {requestKey: 'task-comment-attachment-77'},
    );
  });
});
