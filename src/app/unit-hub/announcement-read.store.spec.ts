import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {UserService} from 'src/app/api/services/user.service';
import {AnnouncementReadStore, READ_STORE_LIMIT} from './announcement-read.store';

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

const KEY = 'ontrack.unitHub.read.7';

const row = (id: number, published_at = '2026-09-10T00:00:00.000Z', updated_at?: string) => ({
  id,
  published_at,
  updated_at,
});

describe('AnnouncementReadStore', () => {
  let user: {currentUser: {id?: number}};

  beforeEach(() => {
    // the test runtime has no usable localStorage of its own
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: memoryStorage()});
    user = {currentUser: {id: 7}};
    TestBed.configureTestingModule({providers: [{provide: UserService, useValue: user}]});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const fresh = () => TestBed.inject(AnnouncementReadStore);

  it('round trips read times through a per-user key', () => {
    const store = fresh();
    store.sync([row(1), row(2)]);
    expect(store.isUnread(row(1))).toBe(true);
    store.markRead([row(1)], new Date('2026-09-12T00:00:00.000Z'));
    expect(store.isUnread(row(1))).toBe(false);
    expect(store.isUnread(row(2))).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({'1': '2026-09-12T00:00:00.000Z'});

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({providers: [{provide: UserService, useValue: user}]});
    const reloaded = fresh();
    reloaded.sync([row(1), row(2)]);
    expect(reloaded.isUnread(row(1))).toBe(false);
  });

  it('counts an announcement edited after it was read as unread again', () => {
    const store = fresh();
    store.sync([row(1)]);
    store.markRead([row(1)], new Date('2026-09-12T00:00:00.000Z'));
    expect(store.isUnread(row(1, '2026-09-10T00:00:00.000Z', '2026-09-11T00:00:00.000Z'))).toBe(
      false,
    );
    expect(store.isUnread(row(1, '2026-09-10T00:00:00.000Z', '2026-09-13T00:00:00.000Z'))).toBe(
      true,
    );
    // republished later with no edit time still counts
    expect(store.isUnread(row(1, '2026-09-14T00:00:00.000Z'))).toBe(true);
  });

  it('treats storage that throws as all unread and never crashes', () => {
    localStorage.setItem(KEY, JSON.stringify({'1': '2026-09-12T00:00:00.000Z'}));
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const store = fresh();
    expect(() => store.sync([row(1)])).not.toThrow();
    expect(store.isUnread(row(1))).toBe(true);
    expect(() => store.markRead([row(1)])).not.toThrow();
    // the mark still applies in this tab
    expect(store.isUnread(row(1))).toBe(false);
  });

  it('survives a runtime with no localStorage at all', () => {
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: undefined});
    const store = fresh();
    expect(() => store.sync([row(1)])).not.toThrow();
    expect(store.isUnread(row(1))).toBe(true);
    expect(() => store.markRead([row(1)])).not.toThrow();
  });

  it('ignores corrupt stored values', () => {
    localStorage.setItem(KEY, '{not json');
    const store = fresh();
    store.sync([row(1)]);
    expect(store.isUnread(row(1))).toBe(true);
    localStorage.setItem(KEY, JSON.stringify({'1': 'yesterday', '2': 5}));
    store.sync([row(1), row(2)]);
    expect(store.isUnread(row(1))).toBe(true);
    expect(store.isUnread(row(2))).toBe(true);
  });

  it('prunes ids that are no longer in the feed and caps the stored entries', () => {
    const many: Record<string, string> = {};
    for (let id = 1; id <= READ_STORE_LIMIT + 20; id++) {
      many[id] = new Date(Date.UTC(2026, 8, 1) + id * 60000).toISOString();
    }
    many['9999'] = '2026-09-12T00:00:00.000Z';
    localStorage.setItem(KEY, JSON.stringify(many));
    const store = fresh();
    const feed = Object.keys(many)
      .filter((id) => id !== '9999')
      .map((id) => row(Number(id), '2026-08-01T00:00:00.000Z'));
    store.sync(feed);
    const saved = JSON.parse(localStorage.getItem(KEY));
    expect(saved['9999']).toBeUndefined();
    expect(Object.keys(saved)).toHaveLength(READ_STORE_LIMIT);
    // the oldest reads are the ones dropped
    expect(saved['1']).toBeUndefined();
    expect(saved[String(READ_STORE_LIMIT + 20)]).toBeDefined();
  });

  it('keeps demo content out of storage and does not prune real entries', () => {
    localStorage.setItem(KEY, JSON.stringify({'42': '2026-09-12T00:00:00.000Z'}));
    const store = fresh();
    store.sync([row(1)], false);
    store.markRead([row(1)]);
    expect(store.isUnread(row(1))).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({'42': '2026-09-12T00:00:00.000Z'});
  });

  it('does not persist without a signed-in user', () => {
    user.currentUser = {};
    const store = fresh();
    store.sync([row(1)]);
    store.markRead([row(1)]);
    expect(localStorage.length).toBe(0);
    expect(store.isUnread(row(1))).toBe(false);
  });
});
