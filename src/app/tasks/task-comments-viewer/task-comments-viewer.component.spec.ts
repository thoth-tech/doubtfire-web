import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {EMPTY, of} from 'rxjs';
import {
  Project,
  Task,
  TaskComment,
  TaskCommentService,
  TaskService,
  UserService,
} from 'src/app/api/models/doubtfire-model';
import {FeedbackTemplateService} from 'src/app/api/services/feedback-template.service';
import {CommentsModalService} from 'src/app/common/modals/comments-modal/comments-modal.service';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {HumanizedDatePipe} from 'src/app/common/pipes/humanized-date.pipe';
import {LocalizedDatePipe} from 'src/app/common/pipes/localized-date.pipe';
import {MarkedPipe} from 'src/app/common/pipes/marked.pipe';
import {AlertService} from 'src/app/common/services/alert.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {CommentBubbleActionComponent} from './comment-bubble-action/comment-bubble-action.component';
import {TaskCommentsViewerComponent} from './task-comments-viewer.component';

const taskCommentServiceStub = {
  commentAdded$: EMPTY,
  fetchAll: vi.fn(),
};
const taskServiceStub = {
  taskStatusUpdated$: EMPTY,
};
const emptyProvider = {};

describe('TaskCommentsViewerComponent', () => {
  let component: TaskCommentsViewerComponent;
  let fixture: ComponentFixture<TaskCommentsViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskCommentsViewerComponent],
      providers: [
        {provide: TaskCommentService, useValue: taskCommentServiceStub},
        {provide: FeedbackTemplateService, useValue: emptyProvider},
        {provide: UserService, useValue: emptyProvider},
        {provide: TaskService, useValue: taskServiceStub},
        {provide: DoubtfireConstants, useValue: emptyProvider},
        {provide: CommentsModalService, useValue: emptyProvider},
        {provide: AlertService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(TaskCommentsViewerComponent, {set: {template: ''}})
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TaskCommentsViewerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('removes cached comments missing from the latest response', () => {
    const keptComment = {
      id: 1,
      text: 'keep',
      recipientReadTime: null,
      recipientIsMe: false,
    } as unknown as TaskComment;

    const staleComment = {
      id: 2,
      text: 'remove',
      recipientReadTime: null,
      recipientIsMe: false,
    } as unknown as TaskComment;

    const latestComment = {
      ...keptComment,
    } as TaskComment;

    const deleteFromCache = vi.fn();

    const task = {
      comments: [keptComment, staleComment],
      commentCache: {
        get: vi.fn((id: number) => (id === 1 ? keptComment : undefined)),
        add: vi.fn(),
        set: vi.fn(),
        delete: deleteFromCache,
      },
      definition: {id: 1},
      numNewComments: 2,
      refreshCommentData: vi.fn(),
    } as unknown as Task;

    component.project = {
      id: 1,
      unit: {currentUserIsStaff: false},
    } as unknown as Project;

    component.scrollDown = vi.fn();
    taskCommentServiceStub.fetchAll.mockReturnValue(of([latestComment]));

    component.fetchComments(task, false);

    expect(deleteFromCache).toHaveBeenCalledTimes(1);
    expect(deleteFromCache).toHaveBeenCalledWith(2);
  });

  // Regression: clicking the reply banner of a deleted comment used to pass an
  // undefined id and throw when scrollIntoView was called on a null element.
  it('scrollToComment does not throw when the comment id is missing', () => {
    expect(() => component.scrollToComment(undefined)).not.toThrow();
  });
});

describe('TaskCommentsViewerComponent bubble actions', () => {
  let component: TaskCommentsViewerComponent;
  let fixture: ComponentFixture<TaskCommentsViewerComponent>;
  let comment: Record<string, unknown>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        TaskCommentsViewerComponent,
        CommentBubbleActionComponent,
        HumanizedDatePipe,
        LocalizedDatePipe,
        MarkedPipe,
      ],
      providers: [
        {provide: TaskCommentService, useValue: taskCommentServiceStub},
        {provide: FeedbackTemplateService, useValue: emptyProvider},
        {provide: UserService, useValue: emptyProvider},
        {provide: TaskService, useValue: taskServiceStub},
        {provide: DoubtfireConstants, useValue: {IsOverseerEnabled: {value: false}}},
        {provide: CommentsModalService, useValue: emptyProvider},
        {provide: ConfirmationModalService, useValue: emptyProvider},
        {provide: AlertService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TaskCommentsViewerComponent);
    component = fixture.componentInstance;

    comment = {
      id: 11,
      commentType: 'text',
      text: 'a comment',
      replyToId: null,
      isNew: false,
      isBubbleComment: true,
      authorIsMe: false,
      shouldShowTimestamp: false,
      shouldShowAvatar: false,
      firstInSeries: false,
      lastRead: false,
      createdAt: new Date(),
      author: {preferredName: 'Ada', lastName: 'Lovelace', name: 'Ada Lovelace'},
    };
    component.task = {comments: [comment], scormEnabled: false} as never;

    fixture.detectChanges();
    component.loading = false;
    fixture.detectChanges();
  });

  function anchor(): HTMLElement {
    return fixture.nativeElement.querySelector('.anchor') as HTMLElement;
  }

  function replyButton(): HTMLButtonElement {
    return anchor().querySelector(
      '.comment-overflow comment-bubble-action button',
    ) as HTMLButtonElement;
  }

  it('renders the comment actions instead of gating them behind a pointer flag', () => {
    const actions = fixture.nativeElement.querySelector('comment-bubble-action') as HTMLElement;

    expect(actions).toBeTruthy();
    expect(actions.hasAttribute('hidden')).toBe(false);
  });

  it('builds the actions out of real buttons rather than bare icons', () => {
    const buttons = anchor().querySelectorAll('comment-bubble-action button');

    expect(buttons.length).toBe(3);
    expect(replyButton().getAttribute('aria-label')).toBe('Reply to this comment');
  });

  it('does not meet the reveal condition while nothing in the comment has focus', () => {
    expect(anchor().matches(':focus-within')).toBe(false);
  });

  it('meets the reveal condition once the keyboard reaches the actions', () => {
    replyButton().focus();

    expect(document.activeElement).toBe(replyButton());
    expect(anchor().matches(':focus-within')).toBe(true);
  });

  it('replies to the comment when the focused button is activated', () => {
    replyButton().focus();
    replyButton().click();

    expect(component.sharedCommentComposerData.originalComment).toBe(comment);
  });
});

describe('TaskCommentsViewerComponent uploadFiles', () => {
  it('does not write placeholder debug logging when a file is uploaded', () => {
    const component = Object.create(TaskCommentsViewerComponent.prototype) as {
      alerts: {error: ReturnType<typeof vi.fn>};
      uploadFiles(event: unknown): void;
    };
    component.alerts = {error: vi.fn()};
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // A rejected file type takes the alerts.error path and does not upload,
    // which is enough to reach the end of uploadFiles where the log used to be.
    component.uploadFiles([{type: 'text/plain'}]);

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
