import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ElementRef, NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {EMPTY, Subject} from 'rxjs';
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
import {ConversationLandingService} from './conversation-landing.service';
import {TaskCommentsViewerComponent} from './task-comments-viewer.component';

const taskCommentServiceStub = {
  commentAdded$: EMPTY,
  fetchAll: vi.fn(),
  downloadAttachment: vi.fn(),
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

  it('routes drag and drop through the composer confirmation and policy flow', () => {
    component.commentComposer = {uploadFiles: vi.fn()};
    const files = [new File(['a,b'], 'results.csv')];
    component.uploadFiles(files);
    expect(component.commentComposer.uploadFiles).toHaveBeenCalledWith(files);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('releases phone feedback scrolling without dropping attachment-card sizing', () => {
    const styles = (
      TaskCommentsViewerComponent as unknown as {
        ɵcmp: {styles: string[]};
      }
    ).ɵcmp.styles.join('\n');

    expect(styles).toMatch(
      /@media\s*\(max-width:\s*639\.98px\)[\s\S]*?\.comments-body[^{]*\{[^}]*overflow-y:\s*visible/,
    );
    expect(styles).toMatch(/\.comment[^{]*\.document-bubble[^{]*\{[^}]*max-width:/);
  });

  it('routes dropped files to the composer for staging instead of posting them', () => {
    const uploadFiles = vi.fn();
    const files = [
      new File(['document'], 'feedback.DOCX', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    ];
    component.commentComposer = {uploadFiles};

    component.uploadFiles(files);

    expect(uploadFiles).toHaveBeenCalledOnce();
    expect(uploadFiles).toHaveBeenCalledWith(files);
    expect(taskCommentServiceStub).not.toHaveProperty('addComment');
  });

  it('does not throw when a reply target has already been deleted', () => {
    expect(() => component.scrollToComment(undefined)).not.toThrow();
    expect(() => component.scrollToComment(404)).not.toThrow();
  });

  it('removes every stale cached comment while reconciling a response', () => {
    const task = new Task();
    const comments = [1, 2, 3].map((id) => ({id}) as TaskComment);
    comments.forEach((comment) => task.commentCache.add(comment));
    vi.spyOn(task, 'refreshCommentData').mockImplementation(() => {});

    (
      component as unknown as {
        mapComments(task: Task, comments: TaskComment[]): void;
      }
    ).mapComments(task, [comments[2]]);

    expect(task.comments.map((comment) => comment.id)).toEqual([3]);
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
      author: {
        preferredName: 'Ada',
        lastName: 'Lovelace',
        name: 'Ada Lovelace',
        displayName: 'Ada Lovelace',
      },
    };
    component.task = {comments: [comment], scormEnabled: false} as never;

    fixture.detectChanges();
    component.loading = false;
    fixture.detectChanges();
  });

  it('shows generic attachment metadata as text and downloads through the authorized service', () => {
    Object.assign(comment, {
      commentType: 'spreadsheet',
      attachmentFileName: '<img src=x onerror=alert(1)>.xlsx',
      attachmentByteSize: 1024,
    });
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      'button[aria-label^="Download "]',
    ) as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.getAttribute('aria-label')).toContain('<img src=x onerror=alert(1)>.xlsx');
    expect(fixture.nativeElement.textContent).toContain('Download only');
    expect(fixture.nativeElement.querySelector('img, iframe, object, embed')).toBeNull();
    button.click();
    expect(taskCommentServiceStub.downloadAttachment).toHaveBeenCalledWith(comment);
  });

  it('renders accessible empty-state text from the real template after loading', () => {
    component.task = {comments: [], scormEnabled: false} as never;
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('#noView') as HTMLElement;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.parentElement.getAttribute('role')).toBe('status');
    expect(icon.parentElement.textContent).toContain('No comments on this task yet.');
  });

  it('does not claim the comments are empty while they are loading', () => {
    component.task = {comments: [], scormEnabled: false} as never;
    component.loading = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#noView')).toBeNull();
  });

  it('renders the empty state safely when no task is selected', () => {
    component.task = undefined;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'No comments on this task yet.',
    );
  });

  it('omits the empty state when the task has a comment', () => {
    expect(fixture.nativeElement.querySelector('#noView')).toBeNull();
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

describe('TaskCommentsViewerComponent latest-message landing', () => {
  let frameCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    frameCallbacks = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flushFrames(): void {
    while (frameCallbacks.length) {
      frameCallbacks.shift()?.(performance.now());
    }
  }

  function taskFor(taskDefinitionId: number): Task {
    const project = {
      id: 7,
      unit: {currentUserIsStaff: false},
    } as unknown as Project;
    // The production constructor receives a real Project instance. This focused
    // test uses a minimal structural project, so attach it explicitly rather
    // than relying on Task's instanceof guard.
    const task = new Task();
    task.project = project;
    task.definition = {id: taskDefinitionId} as never;
    return task;
  }

  function createViewer(
    fetchAll: ReturnType<typeof vi.fn>,
    conversationLanding: ConversationLandingService,
    query: ReturnType<typeof vi.fn> = vi.fn(),
  ): {
    viewer: TaskCommentsViewerComponent;
    commentsBody: HTMLElement;
    conversationEnd: HTMLElement;
    commentsFooter: HTMLElement;
  } {
    const taskCommentService = {
      commentAdded$: new Subject<TaskComment>(),
      fetchAll,
      query,
    };
    const taskService = {taskStatusUpdated$: new Subject<Task>()};
    const viewer = new TaskCommentsViewerComponent(
      taskCommentService as unknown as TaskCommentService,
      {} as FeedbackTemplateService,
      {} as UserService,
      taskService as unknown as TaskService,
      {IsOverseerEnabled: {value: false}} as DoubtfireConstants,
      {} as CommentsModalService,
      {} as AlertService,
      conversationLanding,
    );

    const commentsBody = {scrollTop: 0, scrollHeight: 960} as HTMLElement;
    const conversationEnd = {scrollIntoView: vi.fn()} as unknown as HTMLElement;
    const commentsFooter = {scrollIntoView: vi.fn()} as unknown as HTMLElement;
    viewer.commentsBody = new ElementRef(commentsBody);
    viewer.conversationEnd = new ElementRef(conversationEnd);
    viewer.commentsFooter = new ElementRef(commentsFooter);
    viewer.ngAfterViewInit();

    return {viewer, commentsBody, conversationEnd, commentsFooter};
  }

  function loadTask(viewer: TaskCommentsViewerComponent, task: Task): void {
    viewer.task = task;
    viewer.project = task.project;
    viewer.ngOnChanges({
      task: {
        currentValue: task,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true,
      },
    });
  }

  it('retains an early request until fresh history is rendered, then reveals without focusing', () => {
    const history$: Subject<TaskComment[]> = new Subject();
    const landing = new ConversationLandingService();
    const task = taskFor(11);
    const request = landing.requestLatestMessages({projectId: 7, taskDefinitionId: 11});
    const {viewer, commentsBody, conversationEnd, commentsFooter} = createViewer(
      vi.fn(() => history$),
      landing,
    );
    const focusKeeper = document.createElement('button');
    document.body.appendChild(focusKeeper);
    focusKeeper.focus();

    loadTask(viewer, task);
    flushFrames();

    expect(commentsBody.scrollTop).toBe(0);
    expect(landing.pendingFor(taskDefinitionTarget(task))).toBe(request);

    history$.next([]);
    flushFrames();

    expect(commentsBody.scrollTop).toBe(960);
    expect(conversationEnd.scrollIntoView).toHaveBeenCalledWith({
      block: 'end',
      inline: 'nearest',
    });
    expect(commentsFooter.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    });
    expect(document.activeElement).toBe(focusKeeper);
    expect(landing.pendingFor(taskDefinitionTarget(task))).toBeNull();

    focusKeeper.remove();
    viewer.ngOnDestroy();
  });

  it('waits for the authoritative response instead of fulfilling from a stale cache', () => {
    const cached$: Subject<TaskComment[]> = new Subject();
    const fresh$: Subject<TaskComment[]> = new Subject();
    const landing = new ConversationLandingService();
    const task = taskFor(11);
    task.commentCache.add({id: 1} as TaskComment);
    landing.requestLatestMessages(taskDefinitionTarget(task));
    const {viewer, commentsBody} = createViewer(
      vi.fn(() => fresh$),
      landing,
      vi.fn(() => cached$),
    );
    Reflect.set(viewer, 'mapComments', vi.fn());

    loadTask(viewer, task);
    cached$.next([{id: 1} as TaskComment]);
    flushFrames();

    expect(commentsBody.scrollTop).toBe(0);
    expect(landing.pendingFor(taskDefinitionTarget(task))).not.toBeNull();

    fresh$.next([{id: 1} as TaskComment]);
    flushFrames();

    expect(commentsBody.scrollTop).toBe(960);
    expect(landing.pendingFor(taskDefinitionTarget(task))).toBeNull();

    viewer.ngOnDestroy();
  });

  it('refreshes an already-mounted conversation before answering a same-route landing request', () => {
    const history$: Subject<TaskComment[]> = new Subject();
    const landing = new ConversationLandingService();
    const task = taskFor(11);
    const fetchAll = vi.fn(() => history$);
    const {viewer, commentsBody} = createViewer(fetchAll, landing);

    loadTask(viewer, task);
    history$.next([]);
    flushFrames();
    commentsBody.scrollTop = 0;

    landing.requestLatestMessages(taskDefinitionTarget(task));
    flushFrames();

    expect(fetchAll).toHaveBeenCalledTimes(2);
    expect(commentsBody.scrollTop).toBe(0);
    expect(landing.pendingFor(taskDefinitionTarget(task))).not.toBeNull();

    history$.next([]);
    flushFrames();

    expect(commentsBody.scrollTop).toBe(960);
    expect(landing.pendingFor(taskDefinitionTarget(task))).toBeNull();

    viewer.ngOnDestroy();
  });

  it('does not let a cancelled task request reveal the next task', () => {
    const firstHistory$: Subject<TaskComment[]> = new Subject();
    const secondHistory$: Subject<TaskComment[]> = new Subject();
    const landing = new ConversationLandingService();
    const firstTask = taskFor(11);
    const secondTask = taskFor(12);
    const fetchAll = vi
      .fn()
      .mockImplementationOnce(() => firstHistory$)
      .mockImplementationOnce(() => secondHistory$);
    const {viewer, commentsBody} = createViewer(fetchAll, landing);

    loadTask(viewer, firstTask);
    loadTask(viewer, secondTask);
    firstHistory$.next([]);
    flushFrames();

    expect(commentsBody.scrollTop).toBe(0);

    secondHistory$.next([]);
    flushFrames();

    expect(commentsBody.scrollTop).toBe(960);

    viewer.ngOnDestroy();
  });

  function taskDefinitionTarget(task: Task): {projectId: number; taskDefinitionId: number} {
    return {projectId: task.project.id, taskDefinitionId: task.definition.id};
  }
});
