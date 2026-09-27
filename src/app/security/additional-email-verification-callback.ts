type ReplaceState = (data: unknown, unused: string, url?: string | URL | null) => void;

let pendingVerificationToken: string | null = null;

/**
 * Capture a verification bearer token before telemetry or Angular starts and
 * remove it from browser history. The fragment is never sent to the web server.
 */
export function captureAndScrubAdditionalEmailVerification(
  href: string = globalThis.location?.href,
  replaceState: ReplaceState = (data, unused, url) =>
    globalThis.history.replaceState(data, unused, url),
): boolean {
  pendingVerificationToken = null;
  if (!href) {
    return true;
  }

  try {
    const url = new URL(href);
    if (!isVerificationPath(url.pathname)) {
      return true;
    }

    const fragment = new URLSearchParams(url.hash.replace(/^#\??/, ''));
    const token = fragment.get('token');
    if (!fragment.has('token') && !url.searchParams.has('token')) {
      return true;
    }

    fragment.delete('token');
    // Query tokens are not supported, but must still be removed from telemetry.
    url.searchParams.delete('token');
    url.hash = fragment.toString() ? `#${fragment.toString()}` : '';
    replaceState(globalThis.history?.state ?? null, '', `${url.pathname}${url.search}${url.hash}`);
    pendingVerificationToken = token;
    return true;
  } catch {
    // Keep the app usable with an incomplete-link message, and disable telemetry
    // when the browser cannot remove the bearer token from its address bar.
    pendingVerificationToken = null;
    return false;
  }
}

function isVerificationPath(pathname: string): boolean {
  return pathname.replace(/\/$/, '') === '/verify_additional_email';
}

/** Defensively remove verification credentials from URLs sent to telemetry. */
export function redactAdditionalEmailVerificationFromUrl(value: string): string {
  try {
    const url = new URL(value, globalThis.location?.origin ?? 'https://invalid.local');
    if (!isVerificationPath(url.pathname)) {
      return value;
    }
    const fragment = new URLSearchParams(url.hash.replace(/^#\??/, ''));
    if (fragment.has('token')) {
      fragment.set('token', '[Filtered]');
    }
    if (url.searchParams.has('token')) {
      url.searchParams.set('token', '[Filtered]');
    }
    url.hash = fragment.toString() ? `#${fragment.toString()}` : '';
    return url.toString();
  } catch {
    return '[Filtered URL]';
  }
}

export function consumeAdditionalEmailVerificationToken(): string | null {
  const token = pendingVerificationToken;
  pendingVerificationToken = null;
  return token;
}
