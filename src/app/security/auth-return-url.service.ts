import {Injectable} from '@angular/core';

const STORAGE_KEY = 'doubtfire_auth_return_url';
const MAX_AGE_MS = 30 * 60 * 1000;
const MAX_URL_LENGTH = 4096;

const AUTH_FLOW_PATHS = new Set([
  '/sign_in',
  '/timeout',
  '/welcome',
  '/unauthorised',
  '/success-close',
  '/lti',
  '/lti/link',
]);

const CALLBACK_SECRET_KEYS = new Set(['authToken', 'auth_token', 'ltiToken', 'lti_token', 'ltik']);

interface StoredReturnUrl {
  url: string;
  capturedAt: number;
}

const hasControlCharacters = (value: string): boolean =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });

const containsCallbackSecret = (url: URL): boolean => {
  if ([...CALLBACK_SECRET_KEYS].some((key) => url.searchParams.has(key))) {
    return true;
  }

  const fragment = new URLSearchParams(url.hash.replace(/^#\??/, ''));
  return [...CALLBACK_SECRET_KEYS].some((key) => fragment.has(key));
};

/**
 * Accept only a local application path. This value is eventually handed to
 * Router.navigateByUrl, so rejecting absolute and protocol-relative URLs here
 * prevents the saved destination becoming an open redirect in a future auth
 * integration.
 */
export const normaliseAuthReturnUrl = (
  candidate: string,
  origin: string = globalThis.location?.origin ?? 'https://invalid.local',
): string | null => {
  if (
    !candidate ||
    candidate.length > MAX_URL_LENGTH ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    hasControlCharacters(candidate)
  ) {
    return null;
  }

  try {
    const base = new URL(origin);
    const url = new URL(candidate, base);

    if (url.origin !== base.origin || AUTH_FLOW_PATHS.has(url.pathname)) {
      return null;
    }

    if (containsCallbackSecret(url)) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
};

/**
 * Keeps a protected destination across the sign-in page and a full-page SSO
 * round trip. Session storage is intentionally tab-scoped; a destination from
 * one user or tab must not unexpectedly redirect another browser session.
 */
@Injectable({providedIn: 'root'})
export class AuthReturnUrlService {
  private memoryFallback: StoredReturnUrl | null = null;

  public remember(url: string): boolean {
    const normalised = normaliseAuthReturnUrl(url);
    if (!normalised) {
      return false;
    }

    const entry: StoredReturnUrl = {url: normalised, capturedAt: Date.now()};
    this.memoryFallback = entry;

    try {
      globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(entry));
    } catch {
      // Some embedded or privacy-restricted browsers disable storage. The
      // in-memory value still handles a database login without a page reload.
    }

    return true;
  }

  public rememberCurrentUrl(): boolean {
    try {
      return this.remember(
        `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`,
      );
    } catch {
      return false;
    }
  }

  public consume(): string | null {
    const entry = this.readAndRemove();
    if (
      !entry ||
      !Number.isFinite(entry.capturedAt) ||
      Date.now() - entry.capturedAt > MAX_AGE_MS ||
      entry.capturedAt > Date.now()
    ) {
      return null;
    }

    return normaliseAuthReturnUrl(entry.url);
  }

  public clear(): void {
    this.memoryFallback = null;
    try {
      globalThis.sessionStorage?.removeItem(STORAGE_KEY);
    } catch {
      // Nothing else to clear when browser storage is unavailable.
    }
  }

  private readAndRemove(): StoredReturnUrl | null {
    let entry = this.memoryFallback;
    this.memoryFallback = null;

    try {
      const stored = globalThis.sessionStorage?.getItem(STORAGE_KEY);
      globalThis.sessionStorage?.removeItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          typeof parsed['url'] === 'string' &&
          typeof parsed['capturedAt'] === 'number'
        ) {
          entry = parsed as StoredReturnUrl;
        } else {
          entry = null;
        }
      }
    } catch {
      // Use the in-memory copy when storage is blocked or malformed.
    }

    return entry;
  }
}
