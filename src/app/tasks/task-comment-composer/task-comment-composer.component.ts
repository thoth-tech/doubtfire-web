import {EmojiSearch} from '@ctrl/ngx-emoji-mart';
import {EmojiData} from '@ctrl/ngx-emoji-mart/ngx-emoji';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DoCheck,
  ElementRef,
  HostListener,
  Inject,
  Input,
  KeyValueDiffer,
  KeyValueDiffers,
  OnChanges,
  OnDestroy,
  OnInit,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from '@angular/material/dialog';
import {NavigationStart, Router} from '@angular/router';
import {Subscription, filter} from 'rxjs';
import {
  FeedbackTemplate,
  Task,
  TaskComment,
  TaskCommentService,
} from 'src/app/api/models/doubtfire-model';
import {UserService} from 'src/app/api/models/doubtfire-model';
import {
  AttachmentPolicy,
  attachmentCategory,
  attachmentError,
} from 'src/app/api/models/task-comment/attachment-policy';
import {AlertService} from 'src/app/common/services/alert.service';
import {EmojiService} from 'src/app/common/services/emoji.service';
import {
  FeedbackDraftContext,
  FeedbackDraftStore,
  StagedFeedbackAttachment,
} from 'src/app/common/services/feedback-draft-store.service';
import {ThemeService} from 'src/app/common/theme/theme.service';
import {TaskCommentsViewerComponent} from '../task-comments-viewer/task-comments-viewer.component';

interface ApiError {
  error?: string | {error?: string; message?: string};
  message?: string;
  status?: number;
}

/**
 * The draft a Send or Save was pressed on. The inbox and the project dashboard
 * reuse one composer while the open task changes, so a response can arrive after
 * another task is showing. It has to land on this draft, not on the open one.
 */
interface PendingSend {
  task: Task;
  context: FeedbackDraftContext | null;
  key: string | null;
  originalComment: TaskComment | null;
  // The text in the field when this draft stopped showing. Once the composer is
  // rebuilt, the stored draft belongs to the new one and may hold newer words.
  text: string | null;
}

/**
 * The task comment viewer needs to share data with the Task Comment Composer. The data needed
 * id defined through this interface.
 */

export interface TaskCommentComposerData {
  [key: string]: TaskComment;
  originalComment: TaskComment;
  editingComment: TaskComment;
}

const APPROVED_CLIPBOARD_IMAGE_TYPES = [
  'image/png',
  'image/bmp',
  'image/tiff',
  'image/jpeg',
  'image/gif',
];

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * The task comment composer is responsible for creating and adding comments to a given task.
 */
@Component({
  selector: 'task-comment-composer',
  templateUrl: './task-comment-composer.component.html',
  styleUrls: ['./task-comment-composer.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskCommentComposerComponent
  implements AfterViewInit, DoCheck, OnChanges, OnDestroy, OnInit
{
  @Input() task: Task;
  @Input() sharedData: TaskCommentComposerData;

  private readonly SUBMITTED_KEY_PREFIX = 'task_comments_submitted_';
  private readonly TEXTAREA_MAX_HEIGHT_PX = 144;
  private readonly routeSubscription: Subscription;
  private draftLoadGeneration = 0;
  private readonly draftLoadTimers: Set<ReturnType<typeof setTimeout>> = new Set();
  public isDraftLoaded = false;
  private submittedTaskIds: Set<number | string> = new Set();

  public isSending: boolean = false;
  // Drafts with a request still in flight, so returning to one shows it as sending.
  private readonly sendingDraftKeys: Set<string> = new Set();
  private destroyed = false;
  private readonly inFlightSends: Set<PendingSend> = new Set();
  public stagedAttachments: StagedFeedbackAttachment[] = [];
  private draftClientRequestId: string | null = null;
  private draftClientRequestFingerprint: string | null = null;
  private draftReplyToId: number | null = null;
  private draftBeforeEdit: string = '';
  // The comment whose text is in the field, or null when the field holds the draft.
  private editedComment: TaskComment | null = null;

  comment = {
    text: '',
    type: 'text',
  };

  @ViewChildren('commentInput') input: QueryList<ElementRef<HTMLTextAreaElement>>;
  @ViewChild('uploader') uploader: ElementRef;
  @ViewChild('emojiPickerHost') emojiPickerHost?: ElementRef<HTMLElement>;
  // The trigger is a Material button, so read its element rather than the component.
  @ViewChild('emojiPickerButton', {read: ElementRef})
  emojiPickerButton?: ElementRef<HTMLButtonElement>;

  differ: KeyValueDiffer<string, TaskComment>;
  showEmojiPicker = false;
  emojiSearchMode = false;
  // eslint-disable-next-line no-useless-escape
  emojiRegex: RegExp = /(?:\:)(.*?)(?=\:|$)/;
  emojiSearchResults: EmojiData[] = [];
  emojiMatch: string;
  showFeedbackTemplatePicker: boolean = false;
  recording = false;

  constructor(
    private differs: KeyValueDiffers,
    public dialog: MatDialog,
    private emojiSearch: EmojiSearch,
    private emojiService: EmojiService,
    private commentsViewer: TaskCommentsViewerComponent,
    private alerts: AlertService,
    @Inject(TaskCommentService) private taskCommentService: TaskCommentService,
    private cdRef: ChangeDetectorRef,
    private userService: UserService,
    private router: Router,
    private draftStore: FeedbackDraftStore,
    public readonly theme: ThemeService,
  ) {
    this.differ = this.differs.find({}).create();
    // submitted tasks from sessionStorage, for this user only
    try {
      const key = this.submittedKey();
      const saved = key ? sessionStorage.getItem(key) : null;
      if (saved) {
        this.submittedTaskIds = new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading submitted tasks:', e);
    }

    this.routeSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationStart))
      .subscribe(() => this.dismissEmojiPicker());
  }

  public attachmentPolicy: AttachmentPolicy | null = null;
  public attachmentPolicyFailed = false;

  ngOnInit(): void {
    this.taskCommentService.attachmentPolicy().subscribe({
      next: (policy) => {
        this.attachmentPolicy = policy;
        this.cdRef.markForCheck();
      },
      error: () => {
        this.attachmentPolicyFailed = true;
        this.cdRef.markForCheck();
      },
    });
  }

  // Staged files that are on their way to the server, for the upload status message.
  public get attachmentsUploading(): number {
    return this.stagedAttachments.filter((item) => item.status === 'uploading').length;
  }

  public get attachmentAccept(): string {
    return (
      this.attachmentPolicy?.categories
        .flatMap((item) => item.extensions.map((ext) => `.${ext}`))
        .join(',') || ''
    );
  }

  public get attachmentGuidance(): string {
    if (!this.attachmentPolicy) {
      return this.attachmentPolicyFailed
        ? 'Attachment requirements are unavailable. Reload to try again. You can still send text.'
        : 'Loading attachment requirements…';
    }
    const formats = this.attachmentPolicy.categories
      .map((item) => `${item.name}: ${item.extensions.join(', ').toUpperCase()}`)
      .join('; ');
    return `${formats}. Each file must be smaller than ${this.attachmentPolicy.max_bytes_exclusive / 1_000_000} MB. Select up to ${this.attachmentPolicy.max_selection_count} files. They post when you press Send.`;
  }

  ngOnChanges(changes: SimpleChanges) {
    this.showFeedbackTemplatePicker = false;
    this.dismissEmojiPicker();

    if (changes.task && changes.task.currentValue !== changes.task.previousValue) {
      const newTask = changes.task.currentValue as Task;
      const previousTask = changes.task.previousValue as Task;
      if (previousTask) {
        const previousText =
          this.editedComment !== null ? this.draftBeforeEdit : this.currentInputText;
        const previousKey = this.getDraftKey(previousTask);
        this.keepTextOfSends(
          (send) => send.task === previousTask || (send.key !== null && send.key === previousKey),
          previousText,
        );
        this.saveDraftForTask(
          previousTask,
          previousText,
          this.sharedData?.originalComment?.id ?? this.draftReplyToId,
        );
      }
      this.cancelDraftLoadTimers();
      this.draftLoadGeneration += 1;

      this.cancelEdit();
      this.sharedData.originalComment = null;
      this.stagedAttachments = [];
      this.draftClientRequestId = null;
      this.draftClientRequestFingerprint = null;
      this.draftReplyToId = null;
      this.clearInput();
      this.isSending = this.sendingDraftKeys.has(this.getDraftKey(newTask) ?? '');

      if (newTask) {
        this.loadDraftForTask(newTask);
      }
    }
  }

  ngAfterViewInit() {
    setTimeout(() => {
      if (this.task?.id) {
        this.loadDraftForTask(this.task);
      }
      this.resizeMessageField();
    }, 100);
  }

  ngOnDestroy(): void {
    this.keepTextOfSends(
      (send) => this.isShowing(send),
      this.editedComment !== null ? this.draftBeforeEdit : this.currentInputText,
    );
    this.saveCurrentDraft();
    this.destroyed = true;
    this.cancelDraftLoadTimers();
    this.draftLoadGeneration += 1;
    this.routeSubscription.unsubscribe();
    this.dismissEmojiPicker();
  }

  // Update onInputChange to reset submitted status
  onInputChange(event: Event) {
    if (this.isEditing) {
      this.resizeMessageField();
      this.keyTyped();
      return;
    }

    const target = event.target as HTMLTextAreaElement;
    const text = target.value;

    // If user is typing something new after submission, reset the submitted status
    if (this.task) {
      const taskKey =
        this.task.id ||
        `${this.task.projectId || this.task.project?.id}_${this.task.definition?.id}`;

      // If this was a previously submitted task and user is typing again,
      // remove from submitted set
      if (this.submittedTaskIds.has(taskKey) && text.trim()) {
        this.submittedTaskIds.delete(taskKey);

        // Update session storage
        try {
          const submittedKey = this.submittedKey();
          if (submittedKey) {
            sessionStorage.setItem(submittedKey, JSON.stringify([...this.submittedTaskIds]));
          }
        } catch (e) {
          console.error('Error saving submitted tasks:', e);
        }
      }
    }

    this.saveCurrentDraft();
    this.resizeMessageField();
    this.keyTyped();
  }

  // The id of whoever is signed in, or null during sign out when currentUser has
  // already been swapped for the anonymous user. A draft with nobody to own it is
  // not worth keeping, so callers return early on null rather than inventing a
  // key. The id and not the username or the email: ids are stable, and an email
  // in a storage key is personal data sitting in plain sight in dev tools.
  private currentUserId(): number | null {
    const id = this.userService?.currentUser?.id;
    return typeof id === 'number' && id > 0 ? id : null;
  }

  private submittedKey(): string | null {
    const userId = this.currentUserId();
    return userId === null ? null : `${this.SUBMITTED_KEY_PREFIX}${userId}`;
  }

  private draftContext(task: Task): FeedbackDraftContext | null {
    const userId = this.currentUserId();
    if (userId === null || !task) {
      return null;
    }

    const projectId = task.projectId || task.project?.id || 0;
    const taskDefinitionId = task.definition?.id || 0;
    if (!task.id && (!projectId || !taskDefinitionId)) {
      return null;
    }

    return {
      userId,
      unitId: task.unit?.id ?? null,
      projectId,
      taskDefinitionId,
      taskId: task.id ?? null,
      conversation: 'task-feedback',
    };
  }

  private getDraftKey(task: Task): string | null {
    const context = this.draftContext(task);
    return context ? this.draftStore.key(context) : null;
  }

  private hasContent(raw: string): boolean {
    return raw.replace(/\s+/g, '').length > 0;
  }

  // Update saveDraftForTask to use the taskDraftContents map
  private saveDraftForTask(
    task: Task,
    _rawFromDom?: string,
    replyToId: number | null = this.originalComment?.id ?? this.draftReplyToId,
  ): void {
    if (!task) {
      return;
    }

    const context = this.draftContext(task);
    if (context === null) {
      return;
    }

    try {
      let raw: string;
      if (_rawFromDom === undefined && this.editedComment !== null) {
        // While editing, the field holds the comment being edited and the draft is set aside.
        raw = this.draftBeforeEdit;
      } else if (this.task?.id === task.id && this.input?.first) {
        raw = _rawFromDom ?? this.input.first.nativeElement.value;
      } else {
        raw = _rawFromDom ?? '';
      }

      this.draftStore.save(
        context,
        raw,
        replyToId,
        this.draftClientRequestId,
        this.draftClientRequestFingerprint,
      );
    } catch (error) {
      console.error('saveDraftForTask error:', error);
    }
  }

  private loadDraftForTask(task: Task) {
    if (!task) {
      return;
    }

    const context = this.draftContext(task);
    if (context === null) {
      return;
    }

    try {
      const generation = ++this.draftLoadGeneration;
      const draft = this.draftStore.load(context);
      this.stagedAttachments = this.draftStore.attachments(context);
      this.draftClientRequestId = draft.clientRequestId;
      this.draftClientRequestFingerprint = draft.clientRequestFingerprint;
      this.draftReplyToId = draft.replyToId;

      if (!draft.text && draft.replyToId === null && this.stagedAttachments.length === 0) {
        return;
      }

      const maxRetries = 5;
      const retryWithTimeout = (attempt = 0) => {
        if (
          generation !== this.draftLoadGeneration ||
          this.getDraftKey(this.task) !== this.draftStore.key(context)
        ) {
          return;
        }
        if (!this.input || !this.input.first || !this.input.first.nativeElement) {
          if (attempt < maxRetries) {
            const timer = setTimeout(() => {
              this.draftLoadTimers.delete(timer);
              retryWithTimeout(attempt + 1);
            }, 200);
            this.draftLoadTimers.add(timer);
            return;
          } else {
            return;
          }
        }

        this.input.first.nativeElement.value = draft.text;
        if (draft.replyToId !== null) {
          this.sharedData.originalComment =
            task.comments?.find((comment) => comment.id === draft.replyToId) ?? null;
        }
        this.resizeMessageField();
        this.isDraftLoaded = true;
        this.cdRef.detectChanges();

        const timer = setTimeout(() => {
          this.draftLoadTimers.delete(timer);
          if (generation !== this.draftLoadGeneration) {
            return;
          }
          this.isDraftLoaded = false;
          this.cdRef.detectChanges();
        }, 1500);
        this.draftLoadTimers.add(timer);
      };

      retryWithTimeout();
    } catch (error) {
      console.error(error);
    }
  }

  private cancelDraftLoadTimers(): void {
    this.draftLoadTimers.forEach((timer) => clearTimeout(timer));
    this.draftLoadTimers.clear();
  }

  private clearInput() {
    if (this.input?.first?.nativeElement) {
      this.input.first.nativeElement.value = '';
      this.resizeMessageField();
      this.cdRef.detectChanges();
    }
  }

  private saveCurrentDraft() {
    if (!this.task) {
      return;
    }
    this.saveDraftForTask(this.task);
  }

  ngDoCheck() {
    if (this.draftReplyToId !== null && this.originalComment == null) {
      this.sharedData.originalComment =
        this.task?.comments?.find((comment) => comment.id === this.draftReplyToId) ?? null;
    }
    // Check to see if the sharedData has changed
    const change = this.differ.diff(this.sharedData);
    if (change) {
      change.forEachChangedItem((item) => {
        // If it has changed to be an actual comment
        if (item != null) {
          this.syncComposerState();
        }
      });
    }
  }

  get originalComment(): TaskComment {
    return this.sharedData.originalComment;
  }

  get editingComment(): TaskComment {
    return this.sharedData.editingComment;
  }

  get isEditing(): boolean {
    return this.editingComment != null;
  }

  get isStaff() {
    return this.task?.unit?.currentUserIsStaff;
  }

  private get currentInputText(): string {
    return this.input?.first?.nativeElement?.value ?? '';
  }

  cancelReply() {
    this.sharedData.originalComment = null;
    this.draftReplyToId = null;
    this.saveCurrentDraft();
  }

  cancelEdit() {
    this.sharedData.editingComment = null;
    this.restoreDraftAfterEdit();
  }

  formatImageName(imageName) {
    const index = imageName.indexOf('.');
    let nameString = imageName.substring(0, index);
    const typeString = imageName.substring(index);

    if (nameString.length > 20) {
      nameString = nameString.substring(0, 20) + '..';
    }

    const finalString = nameString + typeString;
    return finalString;
  }

  recordingMode(): void {
    this.recording = !this.recording;
    this.dismissEmojiPicker();
  }

  get canSendMessage(): boolean {
    return (
      !this.isSending &&
      (this.currentInputText.trim().length > 0 || this.stagedAttachments.length > 0)
    );
  }

  get hasDiscardableDraft(): boolean {
    return (
      !this.isEditing &&
      (this.hasContent(this.currentInputText) ||
        this.originalComment != null ||
        this.stagedAttachments.length > 0)
    );
  }

  send(e?: Event) {
    e?.preventDefault();
    if (!this.canSendMessage) {
      return;
    }

    if (this.isEditing) {
      this.saveEditedComment();
    } else {
      this.addComment();
    }
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  dismissEmojiPicker(restoreTriggerFocus: boolean = false): void {
    if (!this.showEmojiPicker) {
      return;
    }

    this.showEmojiPicker = false;
    if (restoreTriggerFocus) {
      setTimeout(() => this.emojiPickerButton?.nativeElement.focus());
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: Event): void {
    this.dismissEmojiPickerFromOutside(event);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    this.dismissEmojiPickerFromOutside(event);
  }

  private dismissEmojiPickerFromOutside(event: Event): void {
    if (!this.showEmojiPicker) {
      return;
    }

    const target = event.target as Node | null;
    if (
      target &&
      (this.emojiPickerHost?.nativeElement?.contains(target) ||
        this.emojiPickerButton?.nativeElement?.contains(target))
    ) {
      return;
    }

    this.dismissEmojiPicker();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapePressed(event: KeyboardEvent): void {
    if (!this.showEmojiPicker) {
      return;
    }

    event.preventDefault();
    this.dismissEmojiPicker(true);
  }

  resizeMessageField(): void {
    const element = this.input?.first?.nativeElement;
    if (!element) {
      return;
    }

    element.style.height = 'auto';
    const contentHeight = Math.max(element.scrollHeight, 24);
    const nextHeight = Math.min(contentHeight, this.TEXTAREA_MAX_HEIGHT_PX);
    element.style.height = `${nextHeight}px`;
    element.style.overflowY = contentHeight > this.TEXTAREA_MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }

  keyTyped() {
    setTimeout(() => {
      const commentText: string = this.currentInputText;
      this.emojiSearchMode = !commentText.includes('`') && this.emojiRegex.test(commentText);

      if (this.emojiSearchMode) {
        // Get the cursor position in the textarea.
        const cursorPosition = this.caretOffset();

        // get the text from the start of the string up to the cursor.
        const testText = commentText.slice(0, cursorPosition);

        // within this smaller string, find the last :
        const lastColPos = testText.lastIndexOf(':');

        // The emoji search term will be from the position after the last :
        // Note, the second parameter is a length not position, so we subtract.
        this.emojiMatch = testText.substr(lastColPos + 1, cursorPosition - lastColPos);

        if (this.emojiMatch?.includes(' ')) {
          this.emojiSearchMode = false;
          this.emojiSearchResults = null;
        } else {
          // results is the list of emoji returned.
          const results = this.emojiSearch.search(this.emojiMatch);
          if (results?.length > 0) {
            this.emojiSearchResults = results.slice(0, 15);
          }
        }
      } // timeout to ensure that the inner html is updated with the new character.
    }, 0);
  }

  emojiSelected(emoji: string) {
    const element = this.input.first.nativeElement;
    element.value = element.value.replace(`:${this.emojiMatch}`, emoji);
    this.emojiSearchMode = false;
    this.resizeMessageField();
    this.saveCurrentDraft();
    element.focus();
  }

  private caretOffset() {
    const element = this.input.first.nativeElement;
    return element.selectionStart ?? element.value.length;
  }

  addEmoji(e): void {
    let char: string;
    if (typeof e === 'string') {
      char = e;
    } else {
      char = e.emoji.native;
    }
    const element = this.input.first.nativeElement;
    const position = this.caretOffset();
    element.setRangeText(char, position, element.selectionEnd ?? position, 'end');
    element.focus();
    this.resizeMessageField();
    this.saveCurrentDraft();
  }

  addFeedback(template: FeedbackTemplate): void {
    const char = template.commentText;
    const element = this.input.first.nativeElement;
    const position = this.caretOffset();
    element.setRangeText(char, position, element.selectionEnd ?? position, 'end');
    element.focus();
    this.resizeMessageField();
    setTimeout(() => {
      this.saveDraftForTask(this.task);
    });
  }

  openDiscussionComposer() {
    this.dialog.open(DiscussionComposerDialog, {
      data: {
        task: this.task,
      },
      maxWidth: '800px',
      disableClose: true,
    });

    // dialogRef.afterOpened().subscribe((result: any) => {
    // });

    // dialogRef.afterClosed().subscribe((result: any) => {
    // });
  }

  addComment() {
    if (this.isSending) {
      return;
    }
    const send = this.pendingSend();
    if (this.stagedAttachments.length > 0) {
      this.uploadAttachmentQueue(send, [...this.stagedAttachments], 0);
      return;
    }

    this.postDraftText(send);
  }

  private pendingSend(): PendingSend {
    const context = this.draftContext(this.task);
    return {
      task: this.task,
      context,
      key: context ? this.draftStore.key(context) : null,
      originalComment: this.sharedData.originalComment,
      text: null,
    };
  }

  private keepTextOfSends(leaving: (send: PendingSend) => boolean, text: string): void {
    for (const send of this.inFlightSends) {
      if (send.text === null && leaving(send)) {
        send.text = text;
      }
    }
  }

  // True while the composer still shows the draft this send was pressed on.
  private isShowing(send: PendingSend): boolean {
    if (this.destroyed) {
      return false;
    }
    return (
      this.task === send.task || (send.key !== null && this.getDraftKey(this.task) === send.key)
    );
  }

  private setSending(send: PendingSend, sending: boolean): void {
    if (sending) {
      this.inFlightSends.add(send);
    } else {
      this.inFlightSends.delete(send);
    }
    if (send.key !== null) {
      if (sending) {
        this.sendingDraftKeys.add(send.key);
      } else {
        this.sendingDraftKeys.delete(send.key);
      }
    }
    if (this.isShowing(send)) {
      this.isSending = sending;
    }
  }

  private attachmentsFor(send: PendingSend): StagedFeedbackAttachment[] {
    if (send.context) {
      return this.draftStore.attachments(send.context);
    }
    return this.isShowing(send) ? this.stagedAttachments : [];
  }

  private postDraftText(send: PendingSend): void {
    const showing = this.isShowing(send);
    // Once another task is open, the field belongs to that task. This draft's text
    // was saved when the task changed, so post that.
    const stored = showing || !send.context ? null : this.draftStore.load(send.context);
    const raw = showing ? this.currentInputText : (send.text ?? stored?.text ?? '');
    if (!this.hasContent(raw)) {
      this.finishSuccessfulDraft(send, raw);
      return;
    }

    this.setSending(send, true);
    const text = this.emojiService.nativeEmojiToColons(raw);
    // The API answers a repeated request id with the comment it already stored and
    // ignores the new text. Reuse an id only for the words and reply it was issued
    // for, so a retry after a lost response is safe but a corrected message is not
    // silently dropped.
    const fingerprint = JSON.stringify([send.originalComment?.id ?? null, text]);
    let clientRequestId: string;
    if (stored && send.context) {
      clientRequestId =
        stored.clientRequestId && stored.clientRequestFingerprint === fingerprint
          ? stored.clientRequestId
          : this.newClientRequestId();
      // Only record the id against the stored draft when it still holds these words.
      if (stored.text === raw) {
        this.draftStore.save(
          send.context,
          stored.text,
          stored.replyToId,
          clientRequestId,
          fingerprint,
        );
      }
    } else {
      if (!this.draftClientRequestId || this.draftClientRequestFingerprint !== fingerprint) {
        this.draftClientRequestId = this.newClientRequestId();
        this.draftClientRequestFingerprint = fingerprint;
      }
      clientRequestId = this.draftClientRequestId;
      this.saveCurrentDraft();
    }

    this.taskCommentService
      .addComment(send.task, text, 'text', send.originalComment, undefined, clientRequestId)
      .subscribe({
        next: (_tc: TaskComment) => {
          this.finishSuccessfulDraft(send, raw);
        },
        error: (error: ApiError) => {
          this.setSending(send, false);
          this.alerts.error(this.uploadErrorMessage(error, 'Failed to send this message.'), 6000);
        },
      });
  }

  private uploadAttachmentQueue(
    send: PendingSend,
    queue: StagedFeedbackAttachment[],
    index: number,
  ): void {
    if (index >= queue.length) {
      this.setSending(send, false);
      if (this.attachmentsFor(send).length === 0) {
        this.postDraftText(send);
      } else {
        this.alerts.error('Some attachments could not be sent. Remove them or retry.', 6000);
      }
      return;
    }

    // The queue is a copy taken when Send was pressed. Upload the live item so a file
    // removed while earlier ones were uploading is skipped.
    const attachment = this.attachmentsFor(send).find(
      (item) => item.clientRequestId === queue[index].clientRequestId,
    );
    if (!attachment) {
      this.uploadAttachmentQueue(send, queue, index + 1);
      return;
    }

    this.setSending(send, true);
    this.updateStagedAttachment(send, attachment.clientRequestId, {
      status: 'uploading',
      progress: 0,
      error: undefined,
    });

    this.taskCommentService
      .uploadStagedAttachment(
        send.task,
        attachment.data,
        attachment.fileName,
        '',
        send.originalComment,
        attachment.clientRequestId,
      )
      .subscribe({
        next: (state) => {
          this.updateStagedAttachment(send, attachment.clientRequestId, {
            status: 'uploading',
            progress: state.progress,
          });
          if (state.state === 'complete') {
            this.removeSentAttachment(send, attachment.clientRequestId);
          }
        },
        error: (error: ApiError) => {
          this.updateStagedAttachment(send, attachment.clientRequestId, {
            status: 'failed',
            error: this.uploadErrorMessage(error, 'Upload failed. Retry or remove this file.'),
          });
          this.uploadAttachmentQueue(send, queue, index + 1);
        },
        complete: () => this.uploadAttachmentQueue(send, queue, index + 1),
      });
  }

  private finishSuccessfulDraft(send: PendingSend, sentText?: string): void {
    this.setSending(send, false);
    const task = send.task;
    const taskKey = task.id || `${task.projectId || task.project?.id}_${task.definition?.id}`;
    this.submittedTaskIds.add(taskKey);
    const submittedKey = this.submittedKey();
    if (submittedKey) {
      sessionStorage.setItem(submittedKey, JSON.stringify([...this.submittedTaskIds]));
    }

    if (send.context) {
      const showing = this.isShowing(send);
      const stored = showing ? null : this.draftStore.load(send.context);
      // A rebuilt composer may have saved newer words for this task since Send was
      // pressed. Those were never sent, so leave them.
      if (showing || sentText === undefined || stored.text === sentText) {
        this.draftStore.clear(send.context);
      }
    }
    if (!this.isShowing(send)) {
      return;
    }
    this.stagedAttachments = [];
    this.draftClientRequestId = null;
    this.draftClientRequestFingerprint = null;
    this.draftReplyToId = null;
    this.sharedData.originalComment = null;
    this.clearInput();
    this.emojiSearchMode = false;
    this.dismissEmojiPicker();
    this.commentsViewer.scrollDown();
  }

  saveEditedComment() {
    if (this.isSending || !this.editingComment) {
      return;
    }

    const send = this.pendingSend();
    const editing = this.editingComment;
    this.setSending(send, true);
    const text = this.emojiService.nativeEmojiToColons(this.currentInputText);

    this.taskCommentService.editComment(editing, text).subscribe({
      next: (_tc: TaskComment) => {
        this.setSending(send, false);
        // Opening another task or cancelling ends the edit and puts that draft back
        // before this lands, so there is nothing left here to clear.
        if (!this.isShowing(send) || this.editingComment !== editing) {
          return;
        }
        this.sharedData.editingComment = null;
        this.emojiSearchMode = false;
        this.dismissEmojiPicker();
        this.restoreDraftAfterEdit();
      },
      error: (error: ApiError) => {
        this.setSending(send, false);
        this.alerts.error(this.uploadErrorMessage(error, 'Failed to edit this comment.'), 6000);
      },
    });
  }

  addCommentWithType(comment: string, type: string) {
    this.taskCommentService.addComment(this.task, comment, type).subscribe({
      next: (_success: TaskComment) => {
        this.comment.text = '';
        this.commentsViewer.scrollDown();
      },
      error: (message: string) => this.alerts.error(message, 6000),
    });
  }

  openFile() {
    this.uploader.nativeElement.click();
  }

  handlePaste(event: ClipboardEvent) {
    const files = this.getClipboardFiles(event);
    this.handleClipboardFiles(files, event);
  }

  handleBeforeInput(event: InputEvent) {
    if (event.inputType !== 'insertFromPaste') {
      return;
    }

    const files = Array.from(event.dataTransfer?.files ?? []);
    this.handleClipboardFiles(files, event);
  }

  // Files are checked against the server-owned attachment policy, then staged on the
  // draft. Nothing is posted until Send, so a staged file can still be removed.
  uploadFiles(files: ArrayLike<File>) {
    if (!files || files.length === 0) {
      return;
    }
    if (!this.attachmentPolicy) {
      this.alerts.error('Attachment requirements are unavailable. Reload and try again.', 6000);
      return;
    }
    if (files.length > this.attachmentPolicy.max_selection_count) {
      this.alerts.error(
        `Choose at most ${this.attachmentPolicy.max_selection_count} attachments at a time.`,
        6000,
      );
      this.resetUploader();
      return;
    }

    Array.from(files).forEach((file) => {
      const validationError = this.attachmentValidationError(file);
      if (validationError) {
        this.alerts.error(validationError, 6000);
        return;
      }

      this.stageAttachment(file, file.name, 'file');
    });

    this.resetUploader();
    this.saveCurrentDraft();
  }

  private lastClipboardPasteSignature = '';
  private lastClipboardPasteAt = 0;
  private readonly CLIPBOARD_DUPLICATE_WINDOW_MS = 250;

  private handleClipboardFiles(files: File[], event: ClipboardEvent | InputEvent) {
    if (files.length === 0) {
      return;
    }

    event.preventDefault();

    const approvedImages = files.filter((file) =>
      APPROVED_CLIPBOARD_IMAGE_TYPES.includes(file.type.toLowerCase()),
    );

    if (approvedImages.length !== files.length) {
      this.alerts.error('Clipboard paste supports approved image files only.', 4000);
    }

    if (approvedImages.length === 0) {
      return;
    }

    const signature = approvedImages
      .map((file) => `${file.name}:${file.type}:${file.size}:${file.lastModified}`)
      .sort()
      .join('|');

    const now = Date.now();

    if (
      signature === this.lastClipboardPasteSignature &&
      now - this.lastClipboardPasteAt < this.CLIPBOARD_DUPLICATE_WINDOW_MS
    ) {
      return;
    }

    this.lastClipboardPasteSignature = signature;
    this.lastClipboardPasteAt = now;

    const existingText = this.currentInputText;

    this.clearPastedPlaceholderContent(existingText);
    this.uploadFiles(approvedImages);
  }

  stageAudioRecording(recording: Blob): void {
    if (!recording || recording.size === 0) {
      return;
    }
    for (const existing of this.stagedAttachments.filter((item) => item.kind === 'audio')) {
      this.removeStagedAttachment(existing.clientRequestId, false);
    }
    const extension = recording.type.includes('ogg') ? 'ogg' : 'webm';
    this.stageAttachment(recording, `feedback-recording.${extension}`, 'audio');
    this.saveCurrentDraft();
  }

  removeStagedAttachment(clientRequestId: string, save: boolean = true): void {
    const context = this.draftContext(this.task);
    if (!context) {
      return;
    }
    const attachment = this.stagedAttachments.find(
      (item) => item.clientRequestId === clientRequestId,
    );
    if (attachment?.status === 'uploading') {
      return;
    }
    this.draftStore.removeAttachment(context, clientRequestId);
    this.stagedAttachments = this.draftStore.attachments(context);
    if (save) {
      this.saveCurrentDraft();
    }
  }

  private removeSentAttachment(send: PendingSend, clientRequestId: string): void {
    if (!send.context) {
      return;
    }
    this.draftStore.removeAttachment(send.context, clientRequestId);
    if (this.isShowing(send)) {
      this.stagedAttachments = this.draftStore.attachments(send.context);
    }
  }

  retryStagedAttachment(clientRequestId: string): void {
    if (this.isSending) {
      return;
    }
    const attachment = this.stagedAttachments.find(
      (item) => item.clientRequestId === clientRequestId,
    );
    if (attachment) {
      this.uploadAttachmentQueue(this.pendingSend(), [attachment], 0);
    }
  }

  discardDraft(): void {
    const context = this.draftContext(this.task);
    if (context) {
      this.draftStore.clear(context);
    }
    this.stagedAttachments = [];
    this.draftClientRequestId = null;
    this.draftClientRequestFingerprint = null;
    this.draftReplyToId = null;
    this.sharedData.originalComment = null;
    this.clearInput();
    this.recording = false;
  }

  // The policy category a staged file falls under, such as PDF or Spreadsheet.
  attachmentCategoryName(attachment: StagedFeedbackAttachment): string | null {
    const named = {name: attachment.fileName} as File;
    return attachmentCategory(this.attachmentPolicy, named)?.name ?? null;
  }

  private stageAttachment(data: File | Blob, fileName: string, kind: 'file' | 'audio'): void {
    const context = this.draftContext(this.task);
    if (!context) {
      this.alerts.error('Sign in before adding an attachment.', 4000);
      return;
    }
    const attachment: StagedFeedbackAttachment = {
      data,
      fileName,
      mimeType: data.type || 'application/octet-stream',
      byteSize: data.size,
      kind,
      clientRequestId: this.newClientRequestId(),
      status: 'staged',
      progress: 0,
    };
    this.draftStore.stageAttachment(context, attachment);
    this.stagedAttachments = this.draftStore.attachments(context);
  }

  private updateStagedAttachment(
    send: PendingSend,
    clientRequestId: string,
    update: Partial<StagedFeedbackAttachment>,
  ): void {
    if (!send.context) {
      return;
    }
    this.draftStore.updateAttachment(send.context, clientRequestId, update);
    if (this.isShowing(send)) {
      this.stagedAttachments = this.draftStore.attachments(send.context);
      this.cdRef.detectChanges();
    }
  }

  // The policy decides which formats and sizes are allowed. The extra DOCX and PDF
  // checks catch a renamed file before it is uploaded.
  private attachmentValidationError(file: File): string | null {
    const policy = this.attachmentPolicy;
    if (!attachmentCategory(policy, file)) {
      return 'Unsupported attachment format. Choose one of the listed formats.';
    }
    const limitMb = policy.max_bytes_exclusive / 1_000_000;
    if (file.size === 0) {
      return `${file.name} is empty. Attachments must not be empty.`;
    }
    if (file.size >= policy.max_bytes_exclusive) {
      return `${file.name} is too large. Attachments must be smaller than ${limitMb} MB.`;
    }

    const mimeType = (file.type ?? '').toLowerCase();
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const unknownMime = mimeType === '' || mimeType === 'application/octet-stream';
    if (extension === 'docx' || mimeType === DOCX_MIME_TYPE) {
      return extension === 'docx' && (mimeType === DOCX_MIME_TYPE || unknownMime)
        ? null
        : `${file.name} does not match the DOCX file type.`;
    }
    if (extension === 'pdf' || mimeType === 'application/pdf' || mimeType === 'image/pdf') {
      return extension === 'pdf' &&
        (mimeType === 'application/pdf' || mimeType === 'image/pdf' || unknownMime)
        ? null
        : `${file.name} does not match the PDF file type.`;
    }
    return null;
  }

  private newClientRequestId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }

  private uploadErrorMessage(error: unknown, fallback: string): string {
    const failure = error as {
      error?: string | {error?: string; message?: string};
      message?: string;
      status?: number;
      name?: string;
    };
    if (failure?.status === 413) {
      return attachmentError(failure);
    }
    // A proxy can answer with an HTML page, which is no use as a message.
    if (
      typeof failure?.error === 'string' &&
      failure.error.trim() &&
      !failure.error.trim().startsWith('<')
    ) {
      return failure.error;
    }
    if (failure?.error && typeof failure.error === 'object') {
      const nested = failure.error.error || failure.error.message;
      if (nested) {
        return nested;
      }
    }
    if (failure?.status === 0) {
      return 'You appear to be offline. Your draft is still here; reconnect and retry.';
    }
    if (failure?.name === 'TimeoutError' || failure?.status === 408 || failure?.status === 504) {
      return 'The upload timed out. Your draft is still here; retry when the connection is stable.';
    }
    return failure?.message || fallback;
  }

  private getClipboardFiles(event: ClipboardEvent): File[] {
    const clipboardData = event.clipboardData;

    if (!clipboardData) {
      return [];
    }

    const directFiles = Array.from(clipboardData.files ?? []);
    if (directFiles.length > 0) {
      return directFiles;
    }

    return Array.from(clipboardData.items ?? [])
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => file != null);
  }

  private clearPastedPlaceholderContent(existingText: string) {
    if (!this.input?.first?.nativeElement) {
      return;
    }

    // Let the browser finish the paste event lifecycle, then restore the pre-paste text
    // so clipboard attachment placeholders do not replace an in-progress draft.
    const generation = this.draftLoadGeneration;
    const draftKey = this.getDraftKey(this.task);
    const timer = setTimeout(() => {
      this.draftLoadTimers.delete(timer);
      if (generation !== this.draftLoadGeneration || draftKey !== this.getDraftKey(this.task)) {
        return;
      }
      this.input.first.nativeElement.value = existingText;
      this.resizeMessageField();
      this.saveCurrentDraft();
      this.cdRef.detectChanges();
    });
    this.draftLoadTimers.add(timer);
  }

  private resetUploader() {
    if (this.uploader?.nativeElement) {
      this.uploader.nativeElement.value = '';
    }
  }

  showFeedbackPicker() {
    this.showFeedbackTemplatePicker = !this.showFeedbackTemplatePicker;
    this.commentsViewer.scrollDown();
  }

  private syncComposerState() {
    if (this.isEditing) {
      this.beginEditingComment();
      return;
    }

    // Reply ends an edit without cancelling it, so the draft has to come back first.
    if (this.editedComment !== null) {
      this.restoreDraftAfterEdit();
    }
    this.draftReplyToId = this.originalComment?.id ?? null;
    this.saveCurrentDraft();
    setTimeout(() => {
      this.input.first.nativeElement.focus();
    });
  }

  private beginEditingComment() {
    const editing = this.editingComment;

    if (this.sharedData.originalComment != null) {
      this.sharedData.originalComment = null;
    }

    if (this.editedComment !== editing) {
      // Set the draft aside only when editing starts. Moving on to edit another
      // comment must not replace it with the first comment's text.
      if (this.editedComment === null) {
        this.draftBeforeEdit = this.currentInputText;
      }
      this.editedComment = editing;
      this.setComposerText(editing?.text ?? '');
    }

    setTimeout(() => {
      this.focusComposerAtEnd();
    });
  }

  private restoreDraftAfterEdit() {
    const draft = this.draftBeforeEdit;
    this.draftBeforeEdit = '';
    this.editedComment = null;
    this.setComposerText(draft);
  }

  private setComposerText(text: string) {
    if (!this.input?.first?.nativeElement) {
      return;
    }

    this.input.first.nativeElement.value = text;
    this.resizeMessageField();
    this.cdRef.detectChanges();
  }

  private focusComposerAtEnd() {
    const element = this.input?.first?.nativeElement;
    if (!element) {
      return;
    }

    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }
}

// The discussion prompt composer dialog Component

@Component({
  selector: 'discussion-prompt-composer-dialog.html',
  templateUrl: 'discussion-prompt-composer-dialog.html',
  styleUrls: ['./discussion-prompt-composer/discussion-prompt-composer.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class DiscussionComposerDialog {
  constructor(
    public dialogRef: MatDialogRef<DiscussionComposerDialog>,
    @Inject(MAT_DIALOG_DATA) public data: {task: Task},
  ) {}
}
