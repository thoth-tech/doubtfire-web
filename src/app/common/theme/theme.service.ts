import {DestroyRef, Injectable, computed, inject, signal} from '@angular/core';
import {Observable, Subscription} from 'rxjs';

/**
 * OnTrack theme foundation (THM-F01). Implements the state model fixed in
 * docs/theme/THEME-CONTRACT.md sections 4, 6 and 11.
 *
 * Two vocabularies, never mixed:
 *   - preference: what the user chose        -> 'light' | 'dark' | 'system'
 *   - resolved:   what is on screen right now -> 'light' | 'dark'
 * 'system' is an instruction, never a resolved value.
 *
 * This service owns the token layer's marker and the resolved-theme signal. The
 * no-flash <head> script (THM-F04), the Tailwind dark variant (THM-F03), the
 * accessible toggle (THM-F02) and the browser theme-color chrome (THM-W01) are
 * deliberately out of scope here.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'] as const;

/** Duplicated as a literal in the THM-F04 no-flash script; THM-T01 asserts they match. */
export const THEME_STORAGE_KEY = 'ontrack.theme.preference';
export const THEME_UPDATED_AT_STORAGE_KEY = 'ontrack.theme.preference.updatedAt';
export const THEME_ACCOUNT_ID_STORAGE_KEY = 'ontrack.theme.preference.accountId';

export interface AccountThemePreference {
  preference: unknown;
  updatedAt: unknown;
}

type SaveAccountThemePreference = (
  preference: ThemePreference,
) => Observable<AccountThemePreference>;

const ACCOUNT_WRITE_DEBOUNCE_MS = 300;
const ISO_8601_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/;

export function isThemePreference(v: unknown): v is ThemePreference {
  return typeof v === 'string' && (THEME_PREFERENCES as readonly string[]).includes(v);
}

/** Reads the stored preference. Any junk, or storage throwing, resolves to 'system'. */
export function readThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

@Injectable({providedIn: 'root'})
export class ThemeService {
  private readonly _preference = signal<ThemePreference>(readThemePreference());
  private readonly _resolved = signal<ResolvedTheme>('light');

  /** The stored choice. The toggle (THM-F02) binds to this so it can highlight 'system'. */
  readonly preference = this._preference.asReadonly();
  /** What is actually painted. Anything that needs the on-screen theme reads this. */
  readonly resolved = this._resolved.asReadonly();
  readonly isDark = computed(() => this._resolved() === 'dark');

  private readonly query: MediaQueryList | null = this.mediaQuery();
  private saveAccountPreference: SaveAccountThemePreference | null = null;
  private accountWriteTimer: ReturnType<typeof setTimeout> | null = null;
  private activeAccountWrite: Subscription | null = null;
  private accountConnectionGeneration = 0;
  private activeAccountId: string | null = null;

  // Held as a stable reference so the same listener can be removed on destroy.
  // One listener for the whole app; it repaints only while the stored choice is
  // 'system'. Contract section 11, item 11.
  private readonly onSystemChange = (): void => {
    if (this._preference() === 'system') {
      this.applyResolved();
    }
  };

  constructor() {
    this.query?.addEventListener('change', this.onSystemChange);
    inject(DestroyRef).onDestroy(() => {
      this.query?.removeEventListener('change', this.onSystemChange);
      this.disconnectAccount();
    });
    this.applyResolved();
  }

  /**
   * Record a new preference. The type gate means an invalid value cannot be
   * stored through the service at all. A storage failure leaves the in-memory
   * preference applied and does not throw.
   *
   * This is the only user-driven write. If a path is ever added that pushes the
   * preference back to the server, it belongs here and nowhere else. The OS
   * change listener (onSystemChange) must never write anywhere: an appearance
   * flip while 'system' is selected is the operating system's decision, not the
   * user's, so it repaints and stops there.
   */
  setPreference(pref: ThemePreference): void {
    if (!isThemePreference(pref)) {
      return;
    }
    const localAccountId = this.readLocalAccountId();
    const ownershipMatches =
      this.activeAccountId === null
        ? localAccountId === null
        : localAccountId === this.activeAccountId;
    if (this.readLocalPreference() === pref && ownershipMatches) {
      return;
    }

    const updatedAt = new Date().toISOString();
    this.commitPreference(pref, updatedAt, this.activeAccountId);
    this.queueAccountWrite(pref);
  }

  /**
   * Reconcile the signed-in account and this device using the phase-two table in
   * contract section 6.2. Presence is decided before timestamps, then a newer
   * timestamp wins when both stores hold a real preference (ties go to account).
   * The save callback keeps this service independent of authentication and API
   * implementation details while still making it the only owner of theme writes.
   */
  connectAccount(
    accountId: number,
    accountPreference: unknown,
    accountUpdatedAt: unknown,
    save: SaveAccountThemePreference,
  ): void {
    this.disconnectAccount();
    const accountStorageId = this.normaliseAccountId(accountId);
    if (accountStorageId === null) {
      return;
    }

    this.activeAccountId = accountStorageId;
    this.saveAccountPreference = save;
    const generation = this.accountConnectionGeneration;

    const localPreference = this.readLocalPreference();
    const localAccountId = this.readLocalAccountId();
    const accountPreferenceIsValid = isThemePreference(accountPreference);
    const belongsToAnotherAccount = localAccountId !== null && localAccountId !== accountStorageId;

    // The theme itself is deliberately retained at sign-out for first paint,
    // but its sync provenance is account-scoped. A retained choice from account
    // A may remain on screen while B signs in; it must never be uploaded to B.
    if (belongsToAnotherAccount) {
      if (accountPreferenceIsValid) {
        this.commitPreference(
          accountPreference,
          this.normaliseAccountTimestamp(accountUpdatedAt),
          accountStorageId,
        );
      }
      return;
    }

    // New device and new account: follow system without inventing a choice.
    if (localPreference === null && !accountPreferenceIsValid) {
      return;
    }

    // A new device adopts the account and becomes flash-free next boot.
    if (localPreference === null && accountPreferenceIsValid) {
      this.commitPreference(
        accountPreference,
        this.normaliseAccountTimestamp(accountUpdatedAt),
        accountStorageId,
      );
      return;
    }

    // Day-one migration: a real local choice beats an empty account even when
    // phase one never wrote a timestamp. Stamp the honest upload time now.
    if (localPreference !== null && !accountPreferenceIsValid) {
      this.commitPreference(localPreference, new Date().toISOString(), accountStorageId);
      this.persistAccount(localPreference, generation);
      return;
    }

    const localUpdatedAt = this.readLocalTimestamp();
    const accountTimestamp = this.normaliseAccountTimestamp(accountUpdatedAt);
    const accountUpdatedAtMs = accountTimestamp === null ? null : Date.parse(accountTimestamp);

    // A missing, malformed, or future local timestamp is older. An account
    // timestamp that is absent is also not sufficient evidence to override the
    // account value, so the tie/default remains account-side.
    const localWins =
      localUpdatedAt !== null && accountUpdatedAtMs !== null && localUpdatedAt > accountUpdatedAtMs;

    if (localWins) {
      this.writeLocalAccountId(accountStorageId);
      this.persistAccount(localPreference as ThemePreference, generation);
    } else {
      this.commitPreference(
        accountPreference as ThemePreference,
        accountTimestamp,
        accountStorageId,
      );
    }
  }

  /** Stop account writes without clearing presentation state from this device. */
  disconnectAccount(): void {
    this.accountConnectionGeneration += 1;
    this.activeAccountId = null;
    this.saveAccountPreference = null;
    if (this.accountWriteTimer !== null) {
      clearTimeout(this.accountWriteTimer);
      this.accountWriteTimer = null;
    }
    this.activeAccountWrite?.unsubscribe();
    this.activeAccountWrite = null;
  }

  /** Store a validated preference, optional timestamp, and repaint. */
  private commitPreference(
    pref: ThemePreference,
    updatedAt?: string | null,
    accountId?: string | null,
  ): void {
    this._preference.set(pref);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
      if (updatedAt === null) {
        localStorage.removeItem(THEME_UPDATED_AT_STORAGE_KEY);
      } else if (updatedAt !== undefined) {
        localStorage.setItem(THEME_UPDATED_AT_STORAGE_KEY, updatedAt);
      }
      if (accountId === null) {
        localStorage.removeItem(THEME_ACCOUNT_ID_STORAGE_KEY);
      } else if (accountId !== undefined) {
        localStorage.setItem(THEME_ACCOUNT_ID_STORAGE_KEY, accountId);
      }
    } catch {
      /* storage blocked; in-memory preference still applies */
    }
    this.applyResolved();
  }

  private queueAccountWrite(pref: ThemePreference): void {
    if (this.saveAccountPreference === null) {
      return;
    }
    if (this.accountWriteTimer !== null) {
      clearTimeout(this.accountWriteTimer);
    }
    this.activeAccountWrite?.unsubscribe();
    this.activeAccountWrite = null;
    const generation = this.accountConnectionGeneration;
    this.accountWriteTimer = setTimeout(() => {
      this.accountWriteTimer = null;
      this.persistAccount(pref, generation);
    }, ACCOUNT_WRITE_DEBOUNCE_MS);
  }

  private persistAccount(pref: ThemePreference, generation: number): void {
    const save = this.saveAccountPreference;
    if (save === null || generation !== this.accountConnectionGeneration) {
      return;
    }

    this.activeAccountWrite?.unsubscribe();
    this.activeAccountWrite = save(pref).subscribe({
      next: (account) => {
        if (
          generation !== this.accountConnectionGeneration ||
          this._preference() !== pref ||
          account.preference !== pref
        ) {
          return;
        }
        const updatedAt = this.normaliseAccountTimestamp(account.updatedAt);
        if (updatedAt !== null) {
          try {
            localStorage.setItem(THEME_UPDATED_AT_STORAGE_KEY, updatedAt);
            if (this.activeAccountId !== null) {
              localStorage.setItem(THEME_ACCOUNT_ID_STORAGE_KEY, this.activeAccountId);
            }
          } catch {
            /* storage blocked; the local preference remains applied */
          }
        }
      },
      error: () => {
        // Presentation state is deliberately local-first. Offline/server errors
        // are silent and retried by reconciliation on the next sign-in.
      },
    });
  }

  private readLocalPreference(): ThemePreference | null {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      return isThemePreference(raw) ? raw : null;
    } catch {
      return null;
    }
  }

  private readLocalAccountId(): string | null {
    try {
      const raw = localStorage.getItem(THEME_ACCOUNT_ID_STORAGE_KEY);
      return raw !== null && raw.length > 0 ? raw : null;
    } catch {
      return null;
    }
  }

  private writeLocalAccountId(accountId: string): void {
    try {
      localStorage.setItem(THEME_ACCOUNT_ID_STORAGE_KEY, accountId);
    } catch {
      /* storage blocked; the in-memory preference remains applied */
    }
  }

  private normaliseAccountId(accountId: number): string | null {
    return Number.isSafeInteger(accountId) && accountId > 0 ? String(accountId) : null;
  }

  /** A malformed or future device timestamp cannot win a conflict. */
  private readLocalTimestamp(): number | null {
    try {
      const raw = localStorage.getItem(THEME_UPDATED_AT_STORAGE_KEY);
      if (raw === null) {
        return null;
      }
      const timestamp = this.parseIsoTimestamp(raw);
      return timestamp !== null && timestamp <= Date.now() ? timestamp : null;
    } catch {
      return null;
    }
  }

  private normaliseAccountTimestamp(value: unknown): string | null {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return value.toISOString();
    }
    if (typeof value !== 'string') {
      return null;
    }
    const timestamp = this.parseIsoTimestamp(value);
    return timestamp === null ? null : new Date(timestamp).toISOString();
  }

  /** Date.parse accepts locale dates and normalises impossible calendar dates. */
  private parseIsoTimestamp(value: string): number | null {
    const match = ISO_8601_TIMESTAMP.exec(value);
    if (match === null) {
      return null;
    }

    const [
      ,
      yearRaw,
      monthRaw,
      dayRaw,
      hourRaw,
      minuteRaw,
      secondRaw,
      offsetHourRaw,
      offsetMinuteRaw,
    ] = match;
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    const second = Number(secondRaw);
    const offsetHour = offsetHourRaw === undefined ? 0 : Number(offsetHourRaw);
    const offsetMinute = offsetMinuteRaw === undefined ? 0 : Number(offsetMinuteRaw);
    const daysInMonth =
      month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;

    if (
      day < 1 ||
      day > daysInMonth ||
      hour > 23 ||
      minute > 59 ||
      second > 59 ||
      offsetHour > 23 ||
      offsetMinute > 59
    ) {
      return null;
    }

    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  /** stored === 'system' ? follow the OS : the stored value. Section 4, one line. */
  resolve(pref: ThemePreference = this._preference()): ResolvedTheme {
    if (pref === 'system') {
      return this.prefersDark() ? 'dark' : 'light';
    }
    return pref;
  }

  private applyResolved(): void {
    const resolved = this.resolve();
    this._resolved.set(resolved);
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    // Only ever 'light' or 'dark' reaches the attribute. Section 5.
    root.setAttribute('data-ot-theme', resolved);
    root.style.colorScheme = resolved;
  }

  private prefersDark(): boolean {
    return this.query?.matches ?? false;
  }

  private mediaQuery(): MediaQueryList | null {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return null; // matchMedia unavailable -> light. Section 11 fallback chain.
    }
    return window.matchMedia('(prefers-color-scheme: dark)');
  }
}
