import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {SimpleChange} from '@angular/core';
import {EMPTY, Subject, of, throwError} from 'rxjs';
import {TaskComment} from 'src/app/api/models/doubtfire-model';
import {AttachmentPolicy} from 'src/app/api/models/task-comment/attachment-policy';
import {AttachmentUploadState, TaskCommentService} from 'src/app/api/services/task-comment.service';
import {
  FeedbackDraftContext,
  FeedbackDraftStore,
  StagedFeedbackAttachment,
} from 'src/app/common/services/feedback-draft-store.service';
import {TaskCommentComposerComponent} from './task-comment-composer.component';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// The same categories the API publishes at /task_comments/upload_policy.
const CHAT_POLICY: AttachmentPolicy = {
  version: 1,
  max_bytes_exclusive: 30_000_000,
  max_selection_count: 5,
  categories: [
    {id: 'pdf', name: 'PDF', extensions: ['pdf'], preview: 'pdf'},
    {id: 'document', name: 'Document', extensions: ['docx'], preview: 'download'},
    {id: 'spreadsheet', name: 'Spreadsheet', extensions: ['csv', 'xlsx'], preview: 'download'},
    {
      id: 'image',
      name: 'Image',
      extensions: ['png', 'bmp', 'tiff', 'tif', 'jpeg', 'jpg', 'gif'],
      preview: 'image',
    },
    {id: 'audio', name: 'Audio', extensions: ['wav', 'ogg', 'mp3', 'webm'], preview: 'audio'},
  ],
};

function memoryStorage(): Storage {
  const values: Map<string, string> = new Map();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, String(value)),
  };
}

function textarea(value = ''): HTMLTextAreaElement {
  const element = document.createElement('textarea');
  element.value = value;
  Object.defineProperty(element, 'scrollHeight', {configurable: true, value: 24});
  return element;
}

function task(id: number) {
  return {
    id,
    projectId: 50,
    project: {id: 50},
    definition: {id: id + 100},
    unit: {id: 9, currentUserIsStaff: false},
    comments: [],
  };
}

function contextFor(taskValue: ReturnType<typeof task>, userId = 7): FeedbackDraftContext {
  return {
    userId,
    unitId: 9,
    projectId: 50,
    taskDefinitionId: taskValue.definition.id,
    taskId: taskValue.id,
    conversation: 'task-feedback',
  };
}

interface ComposerHarness {
  component: TaskCommentComposerComponent;
  draftStore: FeedbackDraftStore;
  taskCommentService: {
    addComment: ReturnType<typeof vi.fn>;
    uploadStagedAttachment: ReturnType<typeof vi.fn>;
    editComment: ReturnType<typeof vi.fn>;
  };
  alerts: {error: ReturnType<typeof vi.fn>};
  message: HTMLTextAreaElement;
}

function createComposer(taskValue = task(1), userId = 7): ComposerHarness {
  const draftStore = new FeedbackDraftStore();
  const taskCommentService = {
    addComment: vi.fn(() => of({id: 1} as TaskComment)),
    uploadStagedAttachment: vi.fn(() =>
      of<AttachmentUploadState>({state: 'complete', progress: 100}),
    ),
    editComment: vi.fn(() => of({id: 1} as TaskComment)),
  };
  const alerts = {error: vi.fn()};
  const message = textarea();
  const component = new TaskCommentComposerComponent(
    {find: () => ({create: () => ({diff: () => null})})} as never,
    {} as never,
    {search: vi.fn(() => [])} as never,
    {nativeEmojiToColons: vi.fn((value: string) => value)} as never,
    {scrollDown: vi.fn()} as never,
    alerts as never,
    taskCommentService as unknown as TaskCommentService,
    {detectChanges: vi.fn(), markForCheck: vi.fn()} as never,
    {currentUser: {id: userId}} as never,
    {events: EMPTY} as never,
    draftStore,
    {isDark: () => false} as never,
  );
  component.attachmentPolicy = CHAT_POLICY;
  component.task = taskValue as never;
  component.sharedData = {originalComment: null, editingComment: null};
  component.input = {first: {nativeElement: message}} as never;
  component.uploader = {nativeElement: {value: 'chosen'}} as never;
  return {component, draftStore, taskCommentService, alerts, message};
}

function fakeFile(name: string, type: string, size = 10): File {
  return {name, type, size} as File;
}

function stagedFile(name: string): StagedFeedbackAttachment {
  return {
    data: fakeFile(name, 'application/pdf'),
    fileName: name,
    mimeType: 'application/pdf',
    byteSize: 10,
    kind: 'file',
    clientRequestId: `staged-${name}`,
    status: 'staged',
    progress: 0,
  };
}

function switchTask(
  harness: ComposerHarness,
  from: ReturnType<typeof task>,
  to: ReturnType<typeof task>,
): void {
  harness.component.task = to as never;
  harness.component.ngOnChanges({
    task: new SimpleChange(from, to, false),
  });
}

function typeDraft(harness: ComposerHarness, text: string): void {
  harness.message.value = text;
  harness.component.onInputChange({target: harness.message} as unknown as Event);
}

// What ngDoCheck does once its differ sees editingComment or originalComment change.
function syncSharedData(harness: ComposerHarness): void {
  (harness.component as unknown as {syncComposerState(): void}).syncComposerState();
}

function startEditing(harness: ComposerHarness, comment: TaskComment): void {
  harness.component.sharedData.editingComment = comment;
  syncSharedData(harness);
}

describe('TaskCommentComposerComponent staged feedback', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: memoryStorage(),
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: memoryStorage(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stages picker files without posting and accepts an uppercase DOCX extension', () => {
    const harness = createComposer();
    const documentFile = fakeFile('Assessment.DOCX', DOCX_MIME);

    harness.component.uploadFiles([documentFile]);

    expect(harness.taskCommentService.uploadStagedAttachment).not.toHaveBeenCalled();
    expect(harness.taskCommentService.addComment).not.toHaveBeenCalled();
    expect(harness.component.stagedAttachments).toHaveLength(1);
    expect(harness.component.stagedAttachments[0]).toMatchObject({
      data: documentFile,
      fileName: 'Assessment.DOCX',
      mimeType: DOCX_MIME,
      status: 'staged',
    });
  });

  it('treats picker cancellation as a no-op and keeps the existing draft intact', () => {
    const harness = createComposer();
    harness.message.value = 'keep typing';
    harness.component.uploadFiles([fakeFile('already.pdf', 'application/pdf')]);
    const before = [...harness.component.stagedAttachments];

    // A cancelled native picker produces an empty selection (and on some
    // browsers no change event at all). Either way, the composer must not send
    // or clear anything.
    harness.component.uploadFiles([]);

    expect(harness.message.value).toBe('keep typing');
    expect(harness.component.stagedAttachments).toEqual(before);
    expect(harness.taskCommentService.uploadStagedAttachment).not.toHaveBeenCalled();
    expect(harness.taskCommentService.addComment).not.toHaveBeenCalled();
  });

  it.each([
    ['renamed.docx', 'application/pdf'],
    ['renamed.pdf', DOCX_MIME],
  ])('rejects extension and MIME mismatches for %s', (name, type) => {
    const harness = createComposer();

    harness.component.uploadFiles([fakeFile(name, type)]);

    expect(harness.component.stagedAttachments).toEqual([]);
    expect(harness.alerts.error).toHaveBeenCalledWith(
      expect.stringContaining('does not match'),
      6000,
    );
  });

  it('enforces the strict smaller-than-30-MB client boundary', () => {
    const harness = createComposer();

    harness.component.uploadFiles([fakeFile('too-large.DOCX', DOCX_MIME, 30_000_000)]);

    expect(harness.component.stagedAttachments).toEqual([]);
    expect(harness.alerts.error).toHaveBeenCalledWith(
      expect.stringContaining('smaller than 30 MB'),
      6000,
    );
  });

  it('keeps multiple staged items independent and removes only the selected one', () => {
    const harness = createComposer();
    harness.component.uploadFiles([
      fakeFile('one.pdf', 'application/pdf'),
      fakeFile('two.DOCX', DOCX_MIME),
    ]);
    const [first, second] = harness.component.stagedAttachments;

    harness.component.removeStagedAttachment(first.clientRequestId);

    expect(harness.component.stagedAttachments).toHaveLength(1);
    expect(harness.component.stagedAttachments[0].clientRequestId).toBe(second.clientRequestId);
  });

  it('replaces only the prior unsent recording and leaves staged files intact', () => {
    const harness = createComposer();
    const firstRecording = new Blob(['first'], {type: 'audio/webm'});
    const replacement = new Blob(['replacement'], {type: 'audio/ogg'});
    harness.component.uploadFiles([fakeFile('notes.pdf', 'application/pdf')]);

    harness.component.stageAudioRecording(firstRecording);
    const oldAudioId = harness.component.stagedAttachments.find(
      (item) => item.kind === 'audio',
    )?.clientRequestId;
    harness.component.stageAudioRecording(replacement);

    expect(harness.component.stagedAttachments).toHaveLength(2);
    expect(harness.component.stagedAttachments.map((item) => item.fileName)).toEqual([
      'notes.pdf',
      'feedback-recording.ogg',
    ]);
    expect(
      harness.component.stagedAttachments.some((item) => item.clientRequestId === oldAudioId),
    ).toBe(false);
  });

  it('sends every attachment with an empty caption, then posts the text exactly once', () => {
    const harness = createComposer();
    harness.message.value = 'Keep this exact\nmessage';
    harness.component.uploadFiles([
      fakeFile('one.pdf', 'application/pdf'),
      fakeFile('two.DOCX', DOCX_MIME),
    ]);
    const attachmentIds = harness.component.stagedAttachments.map((item) => item.clientRequestId);

    harness.component.addComment();

    expect(harness.taskCommentService.uploadStagedAttachment).toHaveBeenCalledTimes(2);
    expect(harness.taskCommentService.uploadStagedAttachment.mock.calls).toEqual([
      [
        harness.component.task,
        expect.objectContaining({name: 'one.pdf'}),
        'one.pdf',
        '',
        null,
        attachmentIds[0],
      ],
      [
        harness.component.task,
        expect.objectContaining({name: 'two.DOCX'}),
        'two.DOCX',
        '',
        null,
        attachmentIds[1],
      ],
    ]);
    expect(harness.taskCommentService.addComment).toHaveBeenCalledOnce();
    expect(harness.taskCommentService.addComment).toHaveBeenCalledWith(
      harness.component.task,
      'Keep this exact\nmessage',
      'text',
      null,
      undefined,
      expect.any(String),
    );
  });

  it('retains a failed item, gives an offline recovery message, and retries with the same id', () => {
    const harness = createComposer();
    harness.taskCommentService.uploadStagedAttachment.mockReturnValueOnce(
      throwError(() => ({status: 0})),
    );
    harness.component.uploadFiles([fakeFile('offline.pdf', 'application/pdf')]);
    const requestId = harness.component.stagedAttachments[0].clientRequestId;

    harness.component.addComment();

    expect(harness.component.stagedAttachments[0]).toMatchObject({
      clientRequestId: requestId,
      status: 'failed',
      error: expect.stringContaining('offline'),
    });
    expect(harness.alerts.error).toHaveBeenCalledWith(
      expect.stringContaining('Some attachments could not be sent'),
      6000,
    );

    harness.taskCommentService.uploadStagedAttachment.mockReturnValueOnce(
      of({state: 'complete', progress: 100}),
    );
    harness.component.retryStagedAttachment(requestId);

    expect(harness.taskCommentService.uploadStagedAttachment).toHaveBeenNthCalledWith(
      2,
      harness.component.task,
      expect.objectContaining({name: 'offline.pdf'}),
      'offline.pdf',
      '',
      null,
      requestId,
    );
    expect(harness.component.stagedAttachments).toEqual([]);
  });

  it('reports timeout recovery without discarding the staged item', () => {
    const harness = createComposer();
    harness.taskCommentService.uploadStagedAttachment.mockReturnValue(
      throwError(() => ({name: 'TimeoutError'})),
    );
    harness.component.uploadFiles([fakeFile('slow.pdf', 'application/pdf')]);

    harness.component.addComment();

    expect(harness.component.stagedAttachments[0].error).toContain('timed out');
    expect(harness.component.stagedAttachments[0].error).toContain('draft is still here');
  });

  it('retries text with one stable idempotency id after an ambiguous failure', () => {
    const harness = createComposer();
    const firstAttempt: Subject<TaskComment> = new Subject();
    harness.taskCommentService.addComment.mockReturnValueOnce(firstAttempt.asObservable());
    harness.message.value = 'send once';

    harness.component.addComment();
    const firstRequestId = harness.taskCommentService.addComment.mock.calls[0][5];
    firstAttempt.error({status: 0});
    harness.taskCommentService.addComment.mockReturnValueOnce(of({id: 2} as TaskComment));
    harness.component.addComment();

    expect(harness.taskCommentService.addComment).toHaveBeenCalledTimes(2);
    expect(harness.taskCommentService.addComment.mock.calls[1][5]).toBe(firstRequestId);
    expect(harness.alerts.error).toHaveBeenCalledWith(expect.stringContaining('offline'), 6000);
  });

  it('keeps task A text, reply, and attachments isolated when moving to task B', () => {
    const taskA = task(1);
    const taskB = task(2);
    const replyTarget = {id: 812} as TaskComment;
    taskA.comments = [replyTarget] as never[];
    const harness = createComposer(taskA);
    harness.message.value = 'task A only';
    harness.component.sharedData.originalComment = replyTarget;
    harness.component.uploadFiles([fakeFile('a.pdf', 'application/pdf')]);

    harness.component.task = taskB as never;
    harness.component.ngOnChanges({
      task: new SimpleChange(taskA, taskB, false),
    });

    expect(harness.draftStore.load(contextFor(taskA)).text).toBe('task A only');
    expect(harness.draftStore.load(contextFor(taskA)).replyToId).toBe(812);
    expect(harness.draftStore.attachments(contextFor(taskA))).toHaveLength(1);
    expect(harness.component.stagedAttachments).toEqual([]);
    expect(harness.message.value).toBe('');
    expect(harness.draftStore.load(contextFor(taskB)).text).toBe('');
    expect(harness.draftStore.load(contextFor(taskB)).replyToId).toBeNull();
    expect(harness.component.sharedData.originalComment).toBeNull();
  });

  it('explicitly discards the exact scoped text-and-reply draft', () => {
    const taskValue = task(3);
    const harness = createComposer(taskValue);
    const replyTarget = {id: 411} as TaskComment;
    harness.component.sharedData.originalComment = replyTarget;
    harness.message.value = 'private unsent reply\nwith whitespace  ';
    harness.component.onInputChange({target: harness.message} as unknown as Event);
    const key = harness.draftStore.key(contextFor(taskValue));

    expect(sessionStorage.getItem(key)).not.toBeNull();
    expect(harness.draftStore.load(contextFor(taskValue))).toMatchObject({
      text: 'private unsent reply\nwith whitespace  ',
      replyToId: 411,
    });

    harness.component.discardDraft();

    expect(sessionStorage.getItem(key)).toBeNull();
    expect(harness.message.value).toBe('');
    expect(harness.component.sharedData.originalComment).toBeNull();
  });

  it('does not let a stale task-A draft timer overwrite task B', () => {
    vi.useFakeTimers();
    const taskA = task(1);
    const taskB = task(2);
    const harness = createComposer(taskA);
    harness.draftStore.save(contextFor(taskA), 'stale A', null);
    harness.component.input = undefined;

    (harness.component as unknown as {loadDraftForTask(taskValue: unknown): void}).loadDraftForTask(
      taskA,
    );

    harness.component.input = {first: {nativeElement: harness.message}} as never;
    harness.component.task = taskB as never;
    harness.component.ngOnChanges({
      task: new SimpleChange(taskA, taskB, false),
    });
    vi.runAllTimers();

    expect(harness.message.value).toBe('');
    expect(harness.component.stagedAttachments).toEqual([]);
  });

  it('finishes a text send on the task it was sent from, not the task open when it lands', () => {
    const taskA = task(1);
    const taskB = task(2);
    const harness = createComposer(taskA);
    const response: Subject<TaskComment> = new Subject();
    harness.taskCommentService.addComment.mockReturnValueOnce(response.asObservable());
    harness.draftStore.save(contextFor(taskB), 'B unsent draft', null);
    harness.draftStore.stageAttachment(contextFor(taskB), stagedFile('b.pdf'));
    harness.message.value = 'A feedback';

    harness.component.addComment();
    switchTask(harness, taskA, taskB);

    expect(harness.message.value).toBe('B unsent draft');
    expect(harness.component.isSending).toBe(false);

    response.next({id: 3} as TaskComment);
    response.complete();

    expect(harness.taskCommentService.addComment).toHaveBeenCalledOnce();
    expect(harness.draftStore.load(contextFor(taskA)).text).toBe('');
    expect(harness.draftStore.load(contextFor(taskB)).text).toBe('B unsent draft');
    expect(harness.draftStore.attachments(contextFor(taskB))).toHaveLength(1);
    expect(harness.component.stagedAttachments).toHaveLength(1);
    expect(harness.message.value).toBe('B unsent draft');
  });

  it('keeps the rest of an attachment queue and its text on the task it was sent from', () => {
    const taskA = task(1);
    const taskB = task(2);
    const harness = createComposer(taskA);
    const firstUpload: Subject<AttachmentUploadState> = new Subject();
    harness.taskCommentService.uploadStagedAttachment.mockReturnValueOnce(
      firstUpload.asObservable(),
    );
    harness.message.value = 'A feedback, see attached';
    harness.component.uploadFiles([
      fakeFile('a1.pdf', 'application/pdf'),
      fakeFile('a2.pdf', 'application/pdf'),
    ]);
    harness.draftStore.save(contextFor(taskB), 'B half-written feedback', null);

    harness.component.addComment();
    switchTask(harness, taskA, taskB);
    firstUpload.next({state: 'complete', progress: 100});
    firstUpload.complete();

    const uploads = harness.taskCommentService.uploadStagedAttachment.mock.calls;
    expect(uploads).toHaveLength(2);
    expect(uploads[0][0]).toBe(taskA);
    expect(uploads[1][0]).toBe(taskA);
    expect(harness.taskCommentService.addComment).toHaveBeenCalledOnce();
    expect(harness.taskCommentService.addComment.mock.calls[0][0]).toBe(taskA);
    expect(harness.taskCommentService.addComment.mock.calls[0][1]).toBe('A feedback, see attached');
    expect(harness.draftStore.attachments(contextFor(taskA))).toEqual([]);
    expect(harness.draftStore.load(contextFor(taskA)).text).toBe('');
    expect(harness.draftStore.load(contextFor(taskB)).text).toBe('B half-written feedback');
    expect(harness.message.value).toBe('B half-written feedback');
    expect(harness.component.isSending).toBe(false);
  });

  it('posts the text Send was pressed on when the composer is rebuilt during an upload', () => {
    const taskValue = task(1);
    const first = createComposer(taskValue);
    const upload: Subject<AttachmentUploadState> = new Subject();
    first.taskCommentService.uploadStagedAttachment.mockReturnValueOnce(upload.asObservable());
    first.message.value = 'Original feedback, see attached';
    first.component.uploadFiles([fakeFile('a1.pdf', 'application/pdf')]);
    first.component.addComment();

    // The phone dashboard destroys the composer when the pane changes and builds a new one.
    first.component.ngOnDestroy();
    const second = createComposer(taskValue);
    (second.component as unknown as {loadDraftForTask(taskValue: unknown): void}).loadDraftForTask(
      taskValue,
    );
    typeDraft(second, 'A new message not sent yet');

    upload.next({state: 'complete', progress: 100});
    upload.complete();

    expect(first.taskCommentService.addComment).toHaveBeenCalledOnce();
    expect(first.taskCommentService.addComment.mock.calls[0][1]).toBe(
      'Original feedback, see attached',
    );
    expect(second.taskCommentService.addComment).not.toHaveBeenCalled();
    expect(second.draftStore.load(contextFor(taskValue)).text).toBe('A new message not sent yet');
  });

  it('shows a send still in flight as sending again after coming back to its task', () => {
    const taskA = task(1);
    const taskB = task(2);
    const harness = createComposer(taskA);
    const response: Subject<TaskComment> = new Subject();
    harness.taskCommentService.addComment.mockReturnValueOnce(response.asObservable());
    harness.message.value = 'A feedback';

    harness.component.addComment();
    switchTask(harness, taskA, taskB);
    expect(harness.component.isSending).toBe(false);
    switchTask(harness, taskB, taskA);
    expect(harness.component.isSending).toBe(true);

    response.next({id: 3} as TaskComment);
    response.complete();

    expect(harness.component.isSending).toBe(false);
    expect(harness.message.value).toBe('');
    expect(harness.draftStore.load(contextFor(taskA)).text).toBe('');
  });

  it('does not clear the task now open when an earlier edit finishes saving', () => {
    const taskA = task(1);
    const taskB = task(2);
    const harness = createComposer(taskA);
    const edit: Subject<TaskComment> = new Subject();
    harness.taskCommentService.editComment.mockReturnValueOnce(edit.asObservable());
    harness.draftStore.save(contextFor(taskB), 'B draft', null);
    startEditing(harness, {id: 5, text: 'Please resubmit'} as TaskComment);
    harness.message.value = 'Please resubmit by Friday';

    harness.component.send();
    switchTask(harness, taskA, taskB);
    edit.next({id: 5} as TaskComment);
    edit.complete();

    expect(harness.taskCommentService.editComment).toHaveBeenCalledOnce();
    expect(harness.message.value).toBe('B draft');
    expect(harness.component.isSending).toBe(false);
  });

  it('does not upload an attachment removed while an earlier one is still uploading', () => {
    const harness = createComposer();
    const firstUpload: Subject<AttachmentUploadState> = new Subject();
    harness.taskCommentService.uploadStagedAttachment.mockReturnValueOnce(
      firstUpload.asObservable(),
    );
    harness.component.uploadFiles([
      fakeFile('one.pdf', 'application/pdf'),
      fakeFile('wrong-student.pdf', 'application/pdf'),
    ]);
    const [first, second] = harness.component.stagedAttachments;

    harness.component.addComment();
    harness.component.removeStagedAttachment(second.clientRequestId);
    firstUpload.next({state: 'complete', progress: 100});
    firstUpload.complete();

    expect(harness.taskCommentService.uploadStagedAttachment).toHaveBeenCalledOnce();
    expect(harness.taskCommentService.uploadStagedAttachment.mock.calls[0][5]).toBe(
      first.clientRequestId,
    );
    expect(harness.component.stagedAttachments).toEqual([]);
  });

  it('uses a new idempotency id when the text changes after an ambiguous failure', () => {
    const harness = createComposer();
    const firstAttempt: Subject<TaskComment> = new Subject();
    harness.taskCommentService.addComment.mockReturnValueOnce(firstAttempt.asObservable());
    harness.message.value = 'Fix the tpyo';

    harness.component.addComment();
    const firstRequestId = harness.taskCommentService.addComment.mock.calls[0][5];
    firstAttempt.error({status: 0});
    harness.message.value = 'Fix the typo';
    harness.component.addComment();

    expect(harness.taskCommentService.addComment).toHaveBeenCalledTimes(2);
    expect(harness.taskCommentService.addComment.mock.calls[1][1]).toBe('Fix the typo');
    expect(harness.taskCommentService.addComment.mock.calls[1][5]).not.toBe(firstRequestId);
  });

  it('uses a new idempotency id when the reply target changes after an ambiguous failure', () => {
    const harness = createComposer();
    const firstAttempt: Subject<TaskComment> = new Subject();
    harness.taskCommentService.addComment.mockReturnValueOnce(firstAttempt.asObservable());
    harness.component.sharedData.originalComment = {id: 812} as TaskComment;
    harness.message.value = 'Same words';

    harness.component.addComment();
    const firstRequestId = harness.taskCommentService.addComment.mock.calls[0][5];
    firstAttempt.error({status: 0});
    harness.component.cancelReply();
    harness.component.addComment();

    expect(harness.taskCommentService.addComment.mock.calls[1][3]).toBeNull();
    expect(harness.taskCommentService.addComment.mock.calls[1][5]).not.toBe(firstRequestId);
  });

  it.each([
    ['keeps', 'send once', 'send once'],
    ['replaces', 'Fix the tpyo', 'Fix the typo'],
  ])(
    '%s the idempotency id across a reload when the retried text is %s then %s',
    (verb, firstText, retriedText) => {
      const taskValue = task(4);
      const firstTab = createComposer(taskValue);
      firstTab.taskCommentService.addComment.mockReturnValueOnce(throwError(() => ({status: 0})));
      firstTab.message.value = firstText;
      firstTab.component.addComment();
      const firstRequestId = firstTab.taskCommentService.addComment.mock.calls[0][5];
      typeDraft(firstTab, retriedText);

      const reloaded = createComposer(taskValue);
      (
        reloaded.component as unknown as {loadDraftForTask(taskValue: unknown): void}
      ).loadDraftForTask(taskValue);
      expect(reloaded.message.value).toBe(retriedText);
      reloaded.component.addComment();

      const retriedRequestId = reloaded.taskCommentService.addComment.mock.calls[0][5];
      if (verb === 'keeps') {
        expect(retriedRequestId).toBe(firstRequestId);
      } else {
        expect(retriedRequestId).not.toBe(firstRequestId);
      }
    },
  );
});

describe('TaskCommentComposerComponent editing keeps the unsent draft', () => {
  const earlierComment = {id: 5, text: 'Please resubmit'} as TaskComment;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: memoryStorage(),
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: memoryStorage(),
    });
  });

  it('when another task is opened during the edit', () => {
    const taskA = task(1);
    const taskB = task(2);
    const harness = createComposer(taskA);
    typeDraft(harness, 'Good start, but fix X');
    startEditing(harness, earlierComment);
    expect(harness.message.value).toBe('Please resubmit');

    switchTask(harness, taskA, taskB);

    expect(harness.draftStore.load(contextFor(taskA)).text).toBe('Good start, but fix X');
  });

  it('when an emoji is added during the edit', () => {
    const harness = createComposer();
    typeDraft(harness, 'Good start, but fix X');
    startEditing(harness, earlierComment);

    harness.component.addEmoji('👍');

    expect(harness.message.value).toContain('👍');
    expect(harness.draftStore.load(contextFor(task(1))).text).toBe('Good start, but fix X');
  });

  it('when the composer is destroyed during the edit', () => {
    const harness = createComposer();
    typeDraft(harness, 'Good start, but fix X');
    startEditing(harness, earlierComment);

    harness.component.ngOnDestroy();

    expect(harness.draftStore.load(contextFor(task(1))).text).toBe('Good start, but fix X');
  });

  it('and puts it back in the field after the edit is saved', () => {
    const harness = createComposer();
    typeDraft(harness, 'Good start, but fix X');
    startEditing(harness, earlierComment);
    harness.message.value = 'Please resubmit by Friday';

    harness.component.send();
    syncSharedData(harness);

    expect(harness.taskCommentService.editComment).toHaveBeenCalledWith(
      earlierComment,
      'Please resubmit by Friday',
    );
    expect(harness.message.value).toBe('Good start, but fix X');
    expect(harness.draftStore.load(contextFor(task(1))).text).toBe('Good start, but fix X');
  });

  it('when Reply is chosen during the edit', () => {
    const harness = createComposer();
    const replyTarget = {id: 812} as TaskComment;
    typeDraft(harness, 'Good start, but fix X');
    startEditing(harness, earlierComment);

    // The Reply bubble action drops the edit and sets a reply target.
    harness.component.sharedData.editingComment = null;
    harness.component.sharedData.originalComment = replyTarget;
    syncSharedData(harness);

    expect(harness.message.value).toBe('Good start, but fix X');
    expect(harness.draftStore.load(contextFor(task(1)))).toMatchObject({
      text: 'Good start, but fix X',
      replyToId: 812,
    });
  });

  it('when a second comment is edited before the first edit ends', () => {
    const harness = createComposer();
    typeDraft(harness, 'Good start, but fix X');
    startEditing(harness, earlierComment);
    harness.message.value = 'Please resubmit by Friday';

    startEditing(harness, {id: 6, text: 'See the rubric'} as TaskComment);
    expect(harness.message.value).toBe('See the rubric');
    harness.component.cancelEdit();

    expect(harness.message.value).toBe('Good start, but fix X');
  });
});

// Method-level test on a bare instance. The composer's constructor wires up a
// KeyValueDiffer and session storage, so we drive addCommentWithType directly
// with stubbed collaborators.
describe('TaskCommentComposerComponent addCommentWithType', () => {
  it('clears the draft and posts without placeholder debug logging', () => {
    const component = Object.create(TaskCommentComposerComponent.prototype) as {
      taskCommentService: {addComment: ReturnType<typeof vi.fn>};
      task: unknown;
      comment: {text: string; type: string};
      commentsViewer: {scrollDown: ReturnType<typeof vi.fn>};
      alerts: {error: ReturnType<typeof vi.fn>};
      addCommentWithType(comment: string, type: string): void;
    };
    component.taskCommentService = {addComment: vi.fn(() => of({}))};
    component.task = {};
    component.comment = {text: 'hello', type: 'text'};
    component.commentsViewer = {scrollDown: vi.fn()};
    component.alerts = {error: vi.fn()};
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    component.addCommentWithType('hello', 'text');

    expect(logSpy).not.toHaveBeenCalled();
    expect(component.comment.text).toBe('');
    expect(component.commentsViewer.scrollDown).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

function clipboardPasteEvent(files: File[]) {
  return {
    clipboardData: {
      files,
      items: [],
    },
    preventDefault: vi.fn(),
  } as never as ClipboardEvent;
}

function beforeInputPasteEvent(files: File[]) {
  return {
    inputType: 'insertFromPaste',
    dataTransfer: {files},
    preventDefault: vi.fn(),
  } as never as InputEvent;
}

function image(name: string, lastModified: number): File {
  return new File(['image'], name, {type: 'image/png', lastModified});
}

describe('TaskCommentComposerComponent clipboard image paste', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: memoryStorage(),
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: memoryStorage(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: memoryStorage(),
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: memoryStorage(),
    });
  });

  function clipboardComposer() {
    const harness = createComposer();
    const uploadSpy = vi.spyOn(harness.component, 'uploadFiles').mockImplementation(() => {});
    return {...harness, uploadSpy};
  }

  it('accepts an approved image from the paste event', () => {
    const {component, uploadSpy} = clipboardComposer();
    const file = image('screenshot.png', 10);
    const event = clipboardPasteEvent([file]);

    component.handlePaste(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(uploadSpy).toHaveBeenCalledWith([file]);
  });

  it('accepts an approved image from the beforeinput path', () => {
    const {component, uploadSpy} = clipboardComposer();
    const file = image('screenshot.png', 20);
    const event = beforeInputPasteEvent([file]);

    component.handleBeforeInput(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(uploadSpy).toHaveBeenCalledWith([file]);
  });

  it('prevents beforeinput and paste from creating the same attachment twice', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T12:00:00Z'));
    const {component, uploadSpy} = clipboardComposer();
    const file = image('screenshot.png', 30);

    component.handleBeforeInput(beforeInputPasteEvent([file]));
    component.handlePaste(clipboardPasteEvent([file]));

    expect(uploadSpy).toHaveBeenCalledOnce();
  });

  it('preserves text already typed when an image is pasted', () => {
    vi.useFakeTimers();
    const {component, message} = clipboardComposer();
    message.value = 'keep this text';

    component.handlePaste(clipboardPasteEvent([image('screenshot.png', 40)]));
    message.value = 'temporary pasted placeholder';
    vi.runAllTimers();

    expect(message.value).toBe('keep this text');
  });

  it('rejects unsupported clipboard files with a clear message', () => {
    const {component, alerts, uploadSpy} = clipboardComposer();
    const pdf = new File(['pdf'], 'evidence.pdf', {type: 'application/pdf', lastModified: 50});
    const event = clipboardPasteEvent([pdf]);

    component.handlePaste(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(alerts.error).toHaveBeenCalledWith(
      'Clipboard paste supports approved image files only.',
      4000,
    );
  });

  it('leaves normal text or HTML paste alone when there is no clipboard file', () => {
    const {component, alerts, uploadSpy} = clipboardComposer();
    const event = {
      clipboardData: {files: [], items: [], types: ['text/plain', 'text/html']},
      preventDefault: vi.fn(),
    } as never as ClipboardEvent;

    component.handlePaste(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(alerts.error).not.toHaveBeenCalled();
  });

  // Attachments are staged and only post on Send, so removing one is how a
  // student backs out of it.
  it('does not post an attachment that is removed before Send', () => {
    const harness = createComposer();
    const image = new File(['image'], 'cancelled.png', {type: 'image/png'});
    harness.component.uploadFiles([image]);
    const [staged] = harness.component.stagedAttachments;

    harness.component.removeStagedAttachment(staged.clientRequestId);
    harness.component.addComment();

    expect(harness.component.stagedAttachments).toEqual([]);
    expect(harness.taskCommentService.uploadStagedAttachment).not.toHaveBeenCalled();
    expect(harness.taskCommentService.addComment).not.toHaveBeenCalled();
  });

  it('shows the API failure when a staged image cannot be posted', () => {
    const harness = createComposer();
    harness.taskCommentService.uploadStagedAttachment.mockReturnValue(
      throwError(() => new Error('Upload failed')),
    );
    harness.component.uploadFiles([new File(['image'], 'failed.png', {type: 'image/png'})]);

    harness.component.addComment();

    expect(harness.component.stagedAttachments[0]).toMatchObject({
      status: 'failed',
      error: 'Upload failed',
    });
    expect(harness.alerts.error).toHaveBeenCalledWith(
      expect.stringContaining('could not be sent'),
      6000,
    );
  });
});

describe('server-owned chat attachment policy', () => {
  const policy: AttachmentPolicy = {
    version: 1,
    max_bytes_exclusive: 30_000_000,
    max_selection_count: 5,
    categories: [
      {id: 'document', name: 'Document', extensions: ['docx'], preview: 'download'},
      {id: 'spreadsheet', name: 'Spreadsheet', extensions: ['csv', 'xlsx'], preview: 'download'},
    ],
  };

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: memoryStorage(),
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: memoryStorage(),
    });
  });

  it('shows exact requirements and stages DOCX, CSV and XLSX even with empty browser MIME', () => {
    const harness = createComposer();
    harness.component.attachmentPolicy = policy;
    harness.component.uploadFiles(
      ['report.DOCX', 'results.csv', 'results.xlsx'].map((name) => new File(['data'], name)),
    );
    expect(harness.component.stagedAttachments.map((item) => item.fileName)).toEqual([
      'report.DOCX',
      'results.csv',
      'results.xlsx',
    ]);
    expect(harness.taskCommentService.uploadStagedAttachment).not.toHaveBeenCalled();
    expect(harness.component.attachmentAccept).toBe('.docx,.csv,.xlsx');
    expect(harness.component.attachmentGuidance).toContain('smaller than 30 MB');
    expect(harness.component.attachmentCategoryName(harness.component.stagedAttachments[1])).toBe(
      'Spreadsheet',
    );
    expect(harness.alerts.error).not.toHaveBeenCalled();
  });

  it('rejects excluded formats, empty files, exact boundary and excessive selection before staging', () => {
    const harness = createComposer();
    harness.component.attachmentPolicy = policy;
    const boundary = new File(['data'], 'large.csv');
    Object.defineProperty(boundary, 'size', {value: 30_000_000});
    harness.component.uploadFiles([
      new File(['x'], 'macro.xlsm'),
      new File([], 'empty.csv'),
      boundary,
    ]);
    harness.component.uploadFiles(Array.from({length: 6}, () => new File(['x'], 'a.csv')));
    expect(harness.component.stagedAttachments).toEqual([]);
    expect(harness.alerts.error).toHaveBeenCalledTimes(4);
  });

  it('fails closed when policy cannot be loaded and preserves a draft on proxy 413', () => {
    const harness = createComposer();
    harness.component.attachmentPolicy = null;
    harness.message.value = 'My draft';
    harness.component.uploadFiles([new File(['x'], 'a.csv')]);
    expect(harness.alerts.error).toHaveBeenCalledWith(expect.stringContaining('unavailable'), 6000);
    expect(harness.component.stagedAttachments).toEqual([]);

    harness.component.attachmentPolicy = policy;
    harness.component.uploadFiles([new File(['x'], 'a.csv')]);
    harness.taskCommentService.uploadStagedAttachment.mockReturnValue(
      throwError(() => ({status: 413, error: '<html>Request too large</html>'})),
    );
    harness.component.addComment();

    expect(harness.message.value).toBe('My draft');
    expect(harness.component.attachmentsUploading).toBe(0);
    expect(harness.component.stagedAttachments[0].error).toContain('too large');
    expect(harness.taskCommentService.addComment).not.toHaveBeenCalled();
  });
});
