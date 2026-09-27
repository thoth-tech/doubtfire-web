import {Injectable, inject} from '@angular/core';
import {UserService} from 'src/app/api/services/user.service';
import {UnitAnnouncement} from './unit-hub.models';

/** Most read times kept per user. The feed itself is capped well below this. */
export const READ_STORE_LIMIT = 500;

type ReadTimes = Record<string, string>;
type ReadableAnnouncement = Pick<UnitAnnouncement, 'id' | 'published_at' | 'updated_at'>;

/**
 * Remembers which Unit Hub announcements the signed-in user has opened.
 *
 * There is no read-receipt API yet, so this lives in localStorage and is per browser.
 * Storage can be missing, full or blocked. Every access is guarded, and a failed read
 * means everything counts as unread. Marks made in this tab still apply until reload.
 */
@Injectable({providedIn: 'root'})
export class AnnouncementReadStore {
  private readonly users = inject(UserService, {optional: true});
  private reads: ReadTimes = {};
  private readsKey: string | null = null;
  private persist = true;

  /** Storage key for the current user, or null when nobody is signed in. */
  get key(): string | null {
    let id: unknown;
    try {
      id = this.users?.currentUser?.id;
    } catch {
      return null;
    }
    return id === undefined || id === null || id === '' ? null : `ontrack.unitHub.read.${id}`;
  }

  /**
   * Loads the stored read times for the current user, keeps only ids still in the feed
   * and writes the pruned set back. Pass persist false for content that is not real,
   * such as the demo feed, so it never touches or prunes the stored entries.
   */
  sync(announcements: readonly ReadableAnnouncement[], persist = true): void {
    const key = this.key;
    if (!persist || key !== this.readsKey || !this.persist) {
      // a different user or a switch between demo and real content starts clean
      this.reads = {};
    }
    this.persist = persist;
    this.readsKey = key;
    if (!persist) {
      return;
    }
    const ids = new Set(announcements.map((row) => String(row.id)));
    const kept: ReadTimes = {};
    // marks made in this tab survive a storage write that failed, the later time wins
    for (const [id, readAt] of [...Object.entries(this.load()), ...Object.entries(this.reads)]) {
      if (ids.has(id) && !(Date.parse(kept[id] ?? '') >= Date.parse(readAt))) {
        kept[id] = readAt;
      }
    }
    this.reads = this.capped(kept);
    this.save();
  }

  isUnread(row: ReadableAnnouncement): boolean {
    const readAt = Date.parse(this.reads[String(row.id)] ?? '');
    if (!Number.isFinite(readAt)) {
      return true;
    }
    const changedAt = Date.parse(row.updated_at || row.published_at || '');
    return Number.isFinite(changedAt) && changedAt > readAt;
  }

  markRead(rows: readonly ReadableAnnouncement[], now = new Date()): void {
    if (!rows.length) {
      return;
    }
    for (const row of rows) {
      // A server clock ahead of this device must not leave a just-opened post unread.
      const changedAt = Date.parse(row.updated_at || row.published_at || '');
      const readAt = Number.isFinite(changedAt)
        ? Math.max(now.getTime(), changedAt)
        : now.getTime();
      this.reads[String(row.id)] = new Date(readAt).toISOString();
    }
    this.reads = this.capped(this.reads);
    this.save();
  }

  private load(): ReadTimes {
    const key = this.key;
    if (!key) {
      return {};
    }
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      const result: ReadTimes = {};
      for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === 'string' && Number.isFinite(Date.parse(value))) {
          result[id] = value;
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  private save(): void {
    const key = this.key;
    if (!key || !this.persist) {
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(this.reads));
    } catch {
      // Storage is full or blocked. The marks stay in memory for this page.
    }
  }

  /** Keeps the most recently read entries when there are more than the limit. */
  private capped(reads: ReadTimes): ReadTimes {
    const entries = Object.entries(reads);
    if (entries.length <= READ_STORE_LIMIT) {
      return reads;
    }
    entries.sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]));
    return Object.fromEntries(entries.slice(0, READ_STORE_LIMIT));
  }
}
