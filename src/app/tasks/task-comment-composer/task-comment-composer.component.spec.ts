import {beforeEach, describe, expect, it} from 'vitest';
import {TaskCommentComposerComponent} from './task-comment-composer.component';

// The composer is a large component with a long constructor. These tests only
// exercise the draft key and the storage guards, so everything else is a stub
// that is never called.
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
