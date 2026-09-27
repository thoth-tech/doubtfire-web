import {beforeEach, describe, expect, it} from 'vitest';
import {
  FeedbackDraftContext,
  FeedbackDraftStore,
  StagedFeedbackAttachment,
} from './feedback-draft-store.service';

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

function context(
  userId: number,
  taskId: number,
  taskDefinitionId = taskId + 100,
): FeedbackDraftContext {
  return {
    userId,
    unitId: 4,
    projectId: 8,
    taskDefinitionId,
    taskId,
    conversation: 'task-feedback',
  };
}

function attachment(clientRequestId: string, fileName: string): StagedFeedbackAttachment {
  const data = new File(['private bytes'], fileName, {type: 'application/pdf'});
  return {
    data,
    fileName,
    mimeType: data.type,
    byteSize: data.size,
    kind: 'file',
    clientRequestId,
    status: 'staged',
    progress: 0,
  };
}

describe('FeedbackDraftStore', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: memoryStorage(),
    });
  });

  it('round-trips exact multiline text, reply context, and the stable text request id', () => {
    const store = new FeedbackDraftStore();
    const scope = context(7, 19);
    const exactText = '  First line  \n\nSecond line\t';

    store.save(scope, exactText, 321, 'text-request-1');

    expect(store.load(scope)).toMatchObject({
      text: exactText,
      replyToId: 321,
      clientRequestId: 'text-request-1',
    });
    expect(store.load(scope).updatedAt).toBeGreaterThan(0);
  });

  it('keeps the text request id paired with the payload it was issued for', () => {
    const store = new FeedbackDraftStore();
    const scope = context(7, 19);

    store.save(scope, 'first words', null, 'text-request-1', '[null,"first words"]');
    store.save(scope, 'first words, then more', null);

    expect(store.load(scope)).toMatchObject({
      text: 'first words, then more',
      clientRequestId: 'text-request-1',
      clientRequestFingerprint: '[null,"first words"]',
    });

    store.save(scope, 'new words', null, 'text-request-2', '[null,"new words"]');

    expect(store.load(scope)).toMatchObject({
      clientRequestId: 'text-request-2',
      clientRequestFingerprint: '[null,"new words"]',
    });
  });

  it('isolates drafts by signed-in user and task conversation', () => {
    const store = new FeedbackDraftStore();
    const userOneTaskA = context(1, 10);
    const userOneTaskB = context(1, 11);
    const userTwoTaskA = context(2, 10);

    store.save(userOneTaskA, 'private A', 12);

    expect(store.key(userOneTaskA)).not.toBe(store.key(userOneTaskB));
    expect(store.key(userOneTaskA)).not.toBe(store.key(userTwoTaskA));
    expect(store.load(userOneTaskA).text).toBe('private A');
    expect(store.load(userOneTaskB).text).toBe('');
    expect(store.load(userTwoTaskA).text).toBe('');
  });

  it('keeps raw staged files in memory only and preserves independent items', () => {
    const store = new FeedbackDraftStore();
    const scope = context(4, 25);
    const first = attachment('file-1', 'first.pdf');
    const second = attachment('file-2', 'second.pdf');

    store.stageAttachment(scope, first);
    store.stageAttachment(scope, second);
    store.save(scope, 'caption', null);

    expect(store.attachments(scope)).toEqual([first, second]);
    const persisted = sessionStorage.getItem(store.key(scope));
    expect(persisted).not.toContain('first.pdf');
    expect(persisted).not.toContain('second.pdf');
    expect(persisted).not.toContain('private bytes');

    const resumedProcess = new FeedbackDraftStore();
    expect(resumedProcess.load(scope).text).toBe('caption');
    expect(resumedProcess.attachments(scope)).toEqual([]);
  });

  it('updates and removes only the selected staged item', () => {
    const store = new FeedbackDraftStore();
    const scope = context(4, 25);
    store.stageAttachment(scope, attachment('file-1', 'first.pdf'));
    store.stageAttachment(scope, attachment('file-2', 'second.pdf'));

    store.updateAttachment(scope, 'file-1', {
      status: 'failed',
      error: 'offline',
    });
    store.removeAttachment(scope, 'file-2');

    expect(store.attachments(scope)).toHaveLength(1);
    expect(store.attachments(scope)[0]).toMatchObject({
      clientRequestId: 'file-1',
      fileName: 'first.pdf',
      status: 'failed',
      error: 'offline',
    });
  });

  it('clears only the requested account on sign out', () => {
    const store = new FeedbackDraftStore();
    const userOne = context(1, 10);
    const userTwo = context(2, 10);
    store.save(userOne, 'one', null);
    store.save(userTwo, 'two', null);
    store.stageAttachment(userOne, attachment('one-file', 'one.pdf'));
    store.stageAttachment(userTwo, attachment('two-file', 'two.pdf'));

    store.clearUser(1);

    expect(store.load(userOne).text).toBe('');
    expect(store.attachments(userOne)).toEqual([]);
    expect(store.load(userTwo).text).toBe('two');
    expect(store.attachments(userTwo)).toHaveLength(1);
  });
});
