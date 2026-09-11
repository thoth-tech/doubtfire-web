export interface AuthCallbackParameters {
  username?: string;
  authToken?: string;
  ltiToken?: string;
  ltik?: string;
  isLtiLogin?: boolean;
}

type ReplaceState = (data: unknown, unused: string, url?: string | URL | null) => void;

const CALLBACK_KEYS = [
  'username',
  'authToken',
  'auth_token',
  'ltiToken',
  'lti_token',
  'ltik',
  'isLtiLogin',
] as const;
const SECRET_KEYS = ['authToken', 'auth_token', 'ltiToken', 'lti_token', 'ltik'] as const;
const TELEMETRY_KEYS = [...SECRET_KEYS, 'username', 'user_name'] as const;

let pendingCallback: AuthCallbackParameters | undefined;

const firstValue = (
  fragment: URLSearchParams,
  query: URLSearchParams,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = fragment.get(key) ?? query.get(key);
    if (value !== null) {
      return value;
    }
  }

  return undefined;
};

const callbackFragment = (hash: string): URLSearchParams =>
  new URLSearchParams(hash.replace(/^#\??/, ''));

/**
 * Capture a one-time authentication callback in module memory and remove it
 * from the address bar before telemetry or Angular start. No callback value is
 * persisted in browser storage or exposed on window.
 */
export const captureAndScrubAuthCallback = (
  href: string = globalThis.location.href,
  replaceState: ReplaceState = (data, unused, url) =>
    globalThis.history.replaceState(data, unused, url),
): boolean => {
  try {
    const url = new URL(href);
    const fragment = callbackFragment(url.hash);
    const containsSecret = SECRET_KEYS.some(
      (key) => fragment.has(key) || url.searchParams.has(key),
    );

    if (!containsSecret) {
      return true;
    }

    const callback: AuthCallbackParameters = {
      username: firstValue(fragment, url.searchParams, 'username'),
      authToken: firstValue(fragment, url.searchParams, 'authToken', 'auth_token'),
      ltiToken: firstValue(fragment, url.searchParams, 'ltiToken', 'lti_token'),
      ltik: firstValue(fragment, url.searchParams, 'ltik'),
      isLtiLogin: firstValue(fragment, url.searchParams, 'isLtiLogin')?.toLowerCase() === 'true',
    };

    for (const key of CALLBACK_KEYS) {
      fragment.delete(key);
      url.searchParams.delete(key);
    }

    const remainingFragment = fragment.toString();
    url.hash = remainingFragment ? `#${remainingFragment}` : '';
    replaceState(globalThis.history?.state ?? null, '', `${url.pathname}${url.search}${url.hash}`);
    pendingCallback = callback;
    return true;
  } catch {
    // If the browser cannot remove the credential from the address bar, keep
    // telemetry disabled and force the user through a fresh sign-in.
    pendingCallback = undefined;
    return false;
  }
};

export const consumeAuthCallback = (): AuthCallbackParameters | undefined => {
  const callback = pendingCallback;
  pendingCallback = undefined;
  return callback;
};

export const buildAuthCallbackFragment = (callback: AuthCallbackParameters): string => {
  const params = new URLSearchParams();

  if (callback.username) {
    params.set('username', callback.username);
  }
  if (callback.authToken) {
    params.set('authToken', callback.authToken);
  }
  if (callback.ltiToken) {
    params.set('ltiToken', callback.ltiToken);
  }
  if (callback.ltik) {
    params.set('ltik', callback.ltik);
  }
  if (callback.isLtiLogin) {
    params.set('isLtiLogin', 'true');
  }

  return params.toString();
};

/** Replace credentials defensively if an error SDK later receives a URL. */
export const redactAuthCallbackFromUrl = (value: string): string => {
  try {
    const url = new URL(value, globalThis.location?.origin ?? 'https://invalid.local');
    const fragment = callbackFragment(url.hash);

    // The inherited SCORM launch endpoint embeds username/token path segments.
    // Redact them from browser telemetry until that endpoint is replaced by a
    // cookie/header-backed launch exchange.
    url.pathname = url.pathname.replace(
      /(\/scorm\/[^/]+\/)[^/]+\/[^/]+(?=\/|$)/,
      '$1[Filtered]/[Filtered]',
    );

    for (const key of TELEMETRY_KEYS) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, '[Filtered]');
      }
      if (fragment.has(key)) {
        fragment.set(key, '[Filtered]');
      }
    }

    const redactedFragment = fragment.toString();
    url.hash = redactedFragment ? `#${redactedFragment}` : '';
    return url.toString();
  } catch {
    return '[Filtered URL]';
  }
};

export const resetAuthCallbackForTest = (): void => {
  pendingCallback = undefined;
};
