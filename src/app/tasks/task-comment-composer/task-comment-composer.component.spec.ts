import {beforeEach, describe, expect, it, vi} from 'vitest';
import {of, throwError} from 'rxjs';
import {TaskCommentComposerComponent} from './task-comment-composer.component';

// The composer is a large component with a long constructor. These tests only
// exercise focused behaviour, so collaborators that are not used are stubs.
function composerFor(currentUser: {id: number | null}): TaskCommentComposerComponent {
  const differs = {find: () => ({create: () => ({})})};
  const userService = {currentUser};

  return new TaskCommentComposerComponent(
    differs as never,
    {} as never, // dialog
    {} as never, // emojiSearch
    {} as never, // emojiService
    {} as never, // commentsViewer
    {} as never, // alerts
    {} as never, // taskCommentService
    {} as never, // cdRef
    userService as never,
  );
}

// getDraftKey, saveDraftForTask and loadDraftForTask are private. Reaching them
// by name is deliberate: the behaviour under test is which storage key gets
// written, and there is no public surface that reveals it.
function draftKeyFor(composer: TaskCommentComposerComponent, task: unknown): string | null {
  return (composer as never as {getDraftKey(t: unknown): string | null}).getDraftKey(task);
}

function saveDraft(composer: TaskCommentComposerComponent, task: unknown, text: string): void {
  (composer as never as {input: unknown}).input = {first: {nativeElement: {innerText: text}}};
  (composer as never as {task: unknown}).task = task;
  (composer as never as {saveDraftForTask(t: unknown): void}).saveDraftForTask(task);
}

function clipboardComposer(text = 'draft text') {
  const component = composerFor({id: 1});
  const nativeElement = {innerText: text};
  const alerts = {error: vi.fn()};
  const cdRef = {detectChanges: vi.fn()};

  component.input = {first: {nativeElement}} as never;
  (component as never as {alerts: typeof alerts}).alerts = alerts;
  (component as never as {cdRef: typeof cdRef}).cdRef = cdRef;

  const uploadSpy = vi.spyOn(component, 'uploadFiles').mockImplementation(() => {});

  return {component, nativeElement, alerts, uploadSpy};
}

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

describe('TaskCommentComposerComponent drafts', () => {
  const task = {id: 123};

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // The ticket. Two people, one browser, the same task.
  it('does not hand one user the draft another user left on the same task', () => {
    const userOne = composerFor({id: 1});
    saveDraft(userOne, task, 'feedback only user one should see');

    expect(localStorage.getItem(draftKeyFor(userOne, task))).toBe(
      'feedback only user one should see',
    );

    const userTwo = composerFor({id: 2});
    expect(localStorage.getItem(draftKeyFor(userTwo, task))).toBeNull();
  });

  it('names the signed in user in the key', () => {
    const composer = composerFor({id: 7});

    expect(draftKeyFor(composer, task)).toBe('task_comment_draft_uid7_123');
    expect(draftKeyFor(composer, {projectId: 4, definition: {id: 9}})).toBe(
      'task_comment_draft_uid7_4_9',
    );
  });

  // currentUser is the anonymous user during sign out, and the composer can still
  // be torn down at that point.
  it('writes nothing when nobody is signed in', () => {
    const composer = composerFor({id: null});

    expect(draftKeyFor(composer, task)).toBeNull();

    saveDraft(composer, task, 'orphaned text');
    expect(localStorage.length).toBe(0);
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

describe('TaskCommentComposerComponent clipboard image paste', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('accepts an approved image from the paste event', () => {
    const {component, uploadSpy} = clipboardComposer();
    const image = new File(['image'], 'screenshot.png', {
      type: 'image/png',
      lastModified: 10,
    });
    const event = clipboardPasteEvent([image]);

    component.handlePaste(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(uploadSpy).toHaveBeenCalledOnce();
    expect(uploadSpy).toHaveBeenCalledWith([image]);
  });

  it('accepts an approved image from the beforeinput path', () => {
    const {component, uploadSpy} = clipboardComposer();
    const image = new File(['image'], 'screenshot.png', {
      type: 'image/png',
      lastModified: 20,
    });
    const event = beforeInputPasteEvent([image]);

    component.handleBeforeInput(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(uploadSpy).toHaveBeenCalledOnce();
    expect(uploadSpy).toHaveBeenCalledWith([image]);
  });

  it('prevents beforeinput and paste from creating the same attachment twice', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T12:00:00Z'));

    const {component, uploadSpy} = clipboardComposer();
    const image = new File(['image'], 'screenshot.png', {
      type: 'image/png',
      lastModified: 30,
    });

    component.handleBeforeInput(beforeInputPasteEvent([image]));
    component.handlePaste(clipboardPasteEvent([image]));

    expect(uploadSpy).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('preserves text already typed when an image is pasted', () => {
    vi.useFakeTimers();

    const {component, nativeElement} = clipboardComposer('keep this text');
    const image = new File(['image'], 'screenshot.png', {
      type: 'image/png',
      lastModified: 40,
    });

    component.handlePaste(clipboardPasteEvent([image]));

    // Simulate browser-inserted placeholder content before the deferred restore runs.
    nativeElement.innerText = 'temporary pasted placeholder';
    vi.runAllTimers();

    expect(nativeElement.innerText).toBe('keep this text');

    vi.useRealTimers();
  });

  it('rejects unsupported clipboard files with a clear message', () => {
    const {component, alerts, uploadSpy} = clipboardComposer();
    const pdf = new File(['pdf'], 'evidence.pdf', {
      type: 'application/pdf',
      lastModified: 50,
    });
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
      clipboardData: {
        files: [],
        items: [],
        types: ['text/plain', 'text/html'],
      },
      preventDefault: vi.fn(),
    } as never as ClipboardEvent;

    component.handlePaste(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(alerts.error).not.toHaveBeenCalled();
  });

  it('does not post an attachment when confirmation is cancelled', () => {
    const component = composerFor({id: 1});
    const image = new File(['image'], 'cancelled.png', {type: 'image/png'});
    const dialog = {
      open: vi.fn(() => ({
        afterClosed: () => of(false),
      })),
    };
    component.dialog = dialog as never;
    const postSpy = vi.spyOn(component, 'postAttachmentComment').mockImplementation(() => {});

    (
      component as never as {
        confirmAttachmentsSequentially(files: File[], index?: number): void;
      }
    ).confirmAttachmentsSequentially([image]);

    expect(dialog.open).toHaveBeenCalledOnce();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('shows the API failure when a confirmed image cannot be posted', () => {
    const component = composerFor({id: 1});
    const alerts = {error: vi.fn()};
    const taskCommentService = {
      addComment: vi.fn(() => throwError(() => new Error('Upload failed'))),
    };

    component.task = {} as never;
    (component as never as {alerts: typeof alerts}).alerts = alerts;
    (component as never as {taskCommentService: typeof taskCommentService}).taskCommentService =
      taskCommentService;

    component.postAttachmentComment(new File(['image'], 'failed.png', {type: 'image/png'}));

    expect(alerts.error).toHaveBeenCalledWith('Upload failed', 2000);
  });
});
