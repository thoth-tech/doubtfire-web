import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {Subscription} from 'rxjs';
import {
  DiscussionComment,
  Project,
  ScormComment,
  ScormExtensionComment,
  Task,
  TaskComment,
  TaskCommentService,
  TaskService,
  UserService,
} from 'src/app/api/models/doubtfire-model';
import {ExtensionComment} from 'src/app/api/models/task-comment/extension-comment';
import {FeedbackTemplateService} from 'src/app/api/services/feedback-template.service';
import {CommentsModalService} from 'src/app/common/modals/comments-modal/comments-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {TaskCommentComposerData} from '../task-comment-composer/task-comment-composer.component';
import {
  ConversationLandingRequest,
  ConversationLandingService,
  ConversationLandingTarget,
} from './conversation-landing.service';
import {TaskAssessmentComment} from './task-assessment-comment/task-assessment-comment.component';

@Component({
  selector: 'task-comments-viewer',
  templateUrl: './task-comments-viewer.component.html',
  styleUrls: ['./task-comments-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskCommentsViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  // Get the comments body from the HTML template
  @ViewChild('commentsBody') commentsBody?: ElementRef<HTMLElement>;
  @ViewChild('conversationEnd') conversationEnd?: ElementRef<HTMLElement>;
  @ViewChild('commentsFooter') commentsFooter?: ElementRef<HTMLElement>;
  @ViewChild('commentComposer') commentComposer?: {uploadFiles(files: ArrayLike<File>): void};

  lastComment: TaskComment;
  @Input() project: Project;
  loading: boolean = true;

  sharedCommentComposerData: TaskCommentComposerData = {
    originalComment: null,
    editingComment: null,
  };

  @Input() comment?: TaskComment;
  @Input() task: Task;
  @Input() refocusOnTaskChange: boolean;

  private taskStatusSub: Subscription;
  private commentAddedSub: Subscription;
  private landingRequestSub: Subscription;
  private commentsRequestSub: Subscription = new Subscription();
  private commentLoadGeneration = 0;
  private freshHistoryReady = false;
  private viewInitialised = false;
  private revealLatestRequested = false;
  private revealFrame: number | null = null;
  private settleFrame: number | null = null;

  constructor(
    private taskCommentService: TaskCommentService,
    private feedbackTemplateService: FeedbackTemplateService,
    private userService: UserService,
    private taskService: TaskService,
    private constants: DoubtfireConstants,
    private commentsModalRef: CommentsModalService,
    private alerts: AlertService,
    private conversationLanding: ConversationLandingService,
  ) {
    this.commentAddedSub = this.taskCommentService.commentAdded$.subscribe(
      (comment: TaskComment) => {
        if (this.commentBelongsToCurrentConversation(comment)) {
          this.revealLatestMessagesAndComposer();
        }
      },
    );

    this.taskStatusSub = this.taskService.taskStatusUpdated$.subscribe((task) => {
      if (this.isCurrentTask(task)) {
        this.fetchComments(task, false);
      }
    });

    this.landingRequestSub = this.conversationLanding.requests$.subscribe((request) => {
      if (this.requestBelongsToCurrentConversation(request)) {
        // A notification can arrive while this exact conversation is already
        // open. Its previously fetched history was authoritative then, but it
        // cannot contain the new server-side message. Reuse the Batch 02 load
        // and reveal boundary with a fresh request instead of scrolling stale
        // rows or guessing a delay here in the routing layer.
        this.fetchComments(this.task, false);
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewInitialised = true;
    this.tryRevealLatestMessagesAndComposer();
  }

  ngOnDestroy(): void {
    this.taskStatusSub?.unsubscribe();
    this.commentAddedSub?.unsubscribe();
    this.landingRequestSub?.unsubscribe();
    this.commentsRequestSub.unsubscribe();
    this.cancelRevealFrames();
  }

  public asAssessmentComment(comment: TaskComment): TaskAssessmentComment | null {
    return comment.commentType === 'assessment'
      ? (comment as unknown as TaskAssessmentComment)
      : null;
  }

  public asScormComment(comment: TaskComment): ScormComment | null {
    return comment.commentType === 'scorm' ? (comment as ScormComment) : null;
  }

  public asExtensionComment(comment: TaskComment): ExtensionComment | null {
    return comment.commentType === 'extension' ? (comment as ExtensionComment) : null;
  }

  public asScormExtensionComment(comment: TaskComment): ScormExtensionComment | null {
    return comment.commentType === 'scorm_extension' ? (comment as ScormExtensionComment) : null;
  }

  public asDiscussionComment(comment: TaskComment): DiscussionComment | null {
    return comment.commentType === 'discussion' ? (comment as DiscussionComment) : null;
  }

  ngOnChanges(changes: SimpleChanges) {
    // Must have project for task to be mapped
    if (changes.task?.currentValue?.project != null) {
      this.project = changes.task.currentValue.project;
      this.loading = true;
      this.fetchComments(this.task, true, true);
    } else {
      this.cancelCommentLoad();
      this.loading = false;
    }
  }

  public fetchComments(
    task: Task,
    useCache: boolean = true,
    fetchAfterCache: boolean = false,
  ): void {
    this.cancelCommentLoad();
    const generation = ++this.commentLoadGeneration;
    this.freshHistoryReady = false;
    this.revealLatestRequested = true;

    this.loadComments(task, useCache, fetchAfterCache, generation);

    if (this.project.unit.currentUserIsStaff) {
      this.feedbackTemplateService
        .query({contextType: 'task_definitions', contextId: task.definition.id}, {})
        .subscribe({
          error: () => this.alerts.error('Error loading task feedback templates.'),
        });
    }
  }

  private loadComments(
    task: Task,
    useCache: boolean,
    fetchAfterCache: boolean,
    generation: number,
  ): void {
    if (!task.comments.length) {
      // If the cache is empty we know the query will attempt to fetch, so we can avoid fetching a second time
      useCache = false;
      fetchAfterCache = false;
    }

    const request$ = !useCache
      ? this.taskCommentService.fetchAll({
          projectId: this.project.id,
          taskDefinitionId: task.definition.id,
        })
      : this.taskCommentService.query(
          {
            projectId: this.project.id,
            taskDefinitionId: task.definition.id,
          },
          task,
          {
            cache: task.commentCache,
            constructorParams: task,
          },
        );

    const requestSub = request$.subscribe({
      next: (comments) => {
        if (!this.isActiveLoad(task, generation)) {
          return;
        }

        this.mapComments(task, comments);
        this.loading = false;

        if (useCache && fetchAfterCache) {
          // Cached history can paint immediately, but a notification can refer to
          // a comment that is not in that cache. Start the authoritative request
          // now and only fulfil a pending landing when that response has rendered.
          this.loadComments(task, false, false, generation);
          return;
        }

        this.freshHistoryReady = true;
        this.tryRevealLatestMessagesAndComposer();
      },
      error: () => {
        if (!this.isActiveLoad(task, generation)) {
          return;
        }

        if (useCache && fetchAfterCache) {
          this.loadComments(task, false, false, generation);
          return;
        }

        // Do not leave the conversation behind an endless spinner. The pending
        // landing is deliberately retained so a later successful retry can
        // fulfil it.
        this.loading = false;
      },
    });
    this.commentsRequestSub.add(requestSub);
  }

  /**
   * Public Batch 02 landing hook. It is safe to call before comment history or
   * the view is ready; the request stays pending until both are available.
   * It scrolls only and never focuses the composer or opens the phone keyboard.
   */
  public revealLatestMessagesAndComposer(): void {
    this.revealLatestRequested = true;
    this.tryRevealLatestMessagesAndComposer();
  }

  /** Backwards-compatible name used by comment creation and template controls. */
  public scrollDown(): void {
    this.revealLatestMessagesAndComposer();
  }

  private mapComments(task: Task, comments: TaskComment[]): void {
    // Remove task notification
    task.numNewComments = 0;

    for (const comment of comments) {
      const existingComment = task.commentCache.get(comment.id);
      comment.task = task;
      if (!existingComment) {
        // Update the cache with any new comments
        task.commentCache.add(comment);
      } else if (
        existingComment.recipientReadTime !== comment.recipientReadTime ||
        existingComment.text !== comment.text
      ) {
        // Update cached read receipts or edited messages
        task.commentCache.set(comment.id, comment);
      }
    }

    const responseIds = new Set(comments.map((comment) => comment.id));
    // Deleting from the cache mutates task.comments, so iterate a snapshot.
    for (const cachedComment of [...task.comments]) {
      if (!responseIds.has(cachedComment.id)) {
        // This comment is in cache but not in the latest comments list
        task.commentCache.delete(cachedComment.id);
      }
    }

    task.refreshCommentData();

    const lastReadComment: TaskComment = task.comments
      .slice()
      .reverse()
      .find((comment: TaskComment) => comment.recipientReadTime != null && !comment.recipientIsMe);

    if (lastReadComment) {
      for (const comment of task.comments) {
        comment.lastRead = false;
      }
      lastReadComment.lastRead = true;
    }
  }

  private tryRevealLatestMessagesAndComposer(): void {
    const target = this.currentConversationTarget();
    if (target && this.conversationLanding.pendingFor(target)) {
      this.revealLatestRequested = true;
    }

    if (
      !this.revealLatestRequested ||
      !this.freshHistoryReady ||
      !this.viewInitialised ||
      !target ||
      !this.commentsBody?.nativeElement ||
      !this.conversationEnd?.nativeElement ||
      !this.commentsFooter?.nativeElement
    ) {
      return;
    }

    this.cancelRevealFrames();
    const generation = this.commentLoadGeneration;

    // A frame is a rendering boundary, unlike the old fixed 50/100ms guesses.
    // Repeating on the following frame catches auto-grown text and newly mounted
    // media controls that finish their first layout immediately after the list.
    this.revealFrame = this.requestFrame(() => {
      this.revealFrame = null;
      if (!this.canFinishReveal(generation, target)) {
        return;
      }

      this.performReveal();
      this.settleFrame = this.requestFrame(() => {
        this.settleFrame = null;
        if (!this.canFinishReveal(generation, target)) {
          return;
        }

        this.performReveal();
        this.revealLatestRequested = false;

        const completedRequest = this.conversationLanding.pendingFor(target);
        if (completedRequest) {
          this.conversationLanding.complete(completedRequest);
        }
      });
    });
  }

  private performReveal(): void {
    const commentsBody = this.commentsBody?.nativeElement;
    if (!commentsBody) {
      return;
    }

    commentsBody.scrollTop = commentsBody.scrollHeight;
    this.conversationEnd?.nativeElement.scrollIntoView?.({block: 'end', inline: 'nearest'});
    this.commentsFooter?.nativeElement.scrollIntoView?.({block: 'nearest', inline: 'nearest'});
    commentsBody.scrollTop = commentsBody.scrollHeight;
  }

  private canFinishReveal(generation: number, target: ConversationLandingTarget): boolean {
    const currentTarget = this.currentConversationTarget();
    return (
      generation === this.commentLoadGeneration &&
      this.freshHistoryReady &&
      !!currentTarget &&
      currentTarget.projectId === target.projectId &&
      currentTarget.taskDefinitionId === target.taskDefinitionId
    );
  }

  private currentConversationTarget(): ConversationLandingTarget | null {
    const projectId = this.task?.project?.id ?? this.project?.id;
    const taskDefinitionId = this.task?.definition?.id;
    if (!projectId || !taskDefinitionId) {
      return null;
    }

    return {projectId, taskDefinitionId};
  }

  private requestBelongsToCurrentConversation(request: ConversationLandingRequest): boolean {
    const target = this.currentConversationTarget();
    return (
      !!target &&
      request.projectId === target.projectId &&
      request.taskDefinitionId === target.taskDefinitionId
    );
  }

  private commentBelongsToCurrentConversation(comment: TaskComment): boolean {
    return this.isCurrentTask(comment?.task);
  }

  private isCurrentTask(task: Task | null | undefined): boolean {
    return (
      !!task &&
      !!this.task &&
      task.project?.id === this.task.project?.id &&
      task.definition?.id === this.task.definition?.id
    );
  }

  private isActiveLoad(task: Task, generation: number): boolean {
    return generation === this.commentLoadGeneration && this.isCurrentTask(task);
  }

  private cancelCommentLoad(): void {
    this.commentsRequestSub.unsubscribe();
    this.commentsRequestSub = new Subscription();
    this.cancelRevealFrames();
  }

  private requestFrame(callback: FrameRequestCallback): number {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      return globalThis.requestAnimationFrame(callback);
    }

    return globalThis.setTimeout(() => callback(performance.now()), 0) as unknown as number;
  }

  private cancelFrame(frame: number | null): void {
    if (frame === null) {
      return;
    }

    if (typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(frame);
    } else {
      globalThis.clearTimeout(frame);
    }
  }

  private cancelRevealFrames(): void {
    this.cancelFrame(this.revealFrame);
    this.cancelFrame(this.settleFrame);
    this.revealFrame = null;
    this.settleFrame = null;
  }

  shouldShowReadReceipt() {
    return this.task.comments.slice(-1)[0]?.authorIsMe;
  }

  get overseerEnabled(): boolean {
    return this.constants.IsOverseerEnabled.value;
  }

  get scormEnabled(): boolean {
    return this.task.scormEnabled;
  }

  uploadFiles(files: ArrayLike<File>) {
    this.commentComposer?.uploadFiles(files);
  }

  downloadAttachment(comment: TaskComment): void {
    this.taskCommentService.downloadAttachment(comment);
  }

  scrollToComment(commentID?: number) {
    if (!commentID) {
      return;
    }
    document.querySelector(`#comment-${commentID}`)?.scrollIntoView();
  }

  openCommentsModal(comment: TaskComment) {
    const resourceUrl = comment.attachmentUrl;
    this.commentsModalRef.show(resourceUrl, comment);
  }

  downloadCommentAttachment(comment: TaskComment): void {
    this.taskCommentService.downloadCommentAttachment(comment);
  }

  shouldShowAuthorIcon(commentType: string) {
    return !(
      commentType === 'extension' ||
      commentType === 'status' ||
      commentType == 'assessment' ||
      commentType === 'scorm' ||
      commentType === 'scorm_extension' ||
      commentType === 'discussed_in_class' ||
      commentType === 'checked_in'
    );
  }

  commentClasses(comment: TaskComment): object {
    return {
      [`${comment.commentType}-bubble`]: true,
      'first-in-series': comment.shouldShowTimestamp || comment.firstInSeries,
      'last-in-series': comment.shouldShowAvatar,
    };
  }
}
