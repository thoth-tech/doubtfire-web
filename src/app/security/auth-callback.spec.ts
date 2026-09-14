import {beforeEach, describe, expect, it} from 'vitest';
import {
  buildAuthCallbackFragment,
  captureAndScrubAuthCallback,
  consumeAuthCallback,
  redactAuthCallbackFromUrl,
  resetAuthCallbackForTest,
} from './auth-callback';

const SENTINEL = 'SECRET_CALLBACK_SENTINEL_7f91';

describe('authentication callback security', () => {
  beforeEach(() => resetAuthCallbackForTest());

  it('captures a fragment callback and removes credentials before startup', () => {
    let cleanUrl = '';

    const safe = captureAndScrubAuthCallback(
      `https://ontrack.example/sign_in#authToken=${SENTINEL}&username=student%40example.edu`,
      (_data, _unused, url) => {
        cleanUrl = String(url);
      },
    );

    expect(safe).toBe(true);
    expect(cleanUrl).toBe('/sign_in');
    expect(cleanUrl).not.toContain(SENTINEL);
    expect(consumeAuthCallback()).toEqual({
      username: 'student@example.edu',
      authToken: SENTINEL,
      ltiToken: undefined,
      ltik: undefined,
      isLtiLogin: false,
    });
    expect(consumeAuthCallback()).toBeUndefined();
  });

  it('supports and scrubs a legacy LTI query while preserving unrelated values', () => {
    let cleanUrl = '';

    captureAndScrubAuthCallback(
      `https://ontrack.example/sign_in?theme=dark&ltiToken=${SENTINEL}&ltik=launch-token&isLtiLogin=true#panel=help`,
      (_data, _unused, url) => {
        cleanUrl = String(url);
      },
    );

    expect(cleanUrl).toBe('/sign_in?theme=dark#panel=help');
    expect(consumeAuthCallback()).toMatchObject({
      ltiToken: SENTINEL,
      ltik: 'launch-token',
      isLtiLogin: true,
    });
  });

  it('disables telemetry and drops the callback when history cannot be scrubbed', () => {
    const safe = captureAndScrubAuthCallback(
      `https://ontrack.example/sign_in#authToken=${SENTINEL}`,
      () => {
        throw new Error('history unavailable');
      },
    );

    expect(safe).toBe(false);
    expect(consumeAuthCallback()).toBeUndefined();
  });

  it('encodes fragment callbacks without putting values in a query', () => {
    const fragment = buildAuthCallbackFragment({
      username: 'student+alias@example.edu',
      authToken: `${SENTINEL}+/=`,
      isLtiLogin: true,
    });
    const values = new URLSearchParams(fragment);

    expect(fragment).not.toContain('?');
    expect(values.get('username')).toBe('student+alias@example.edu');
    expect(values.get('authToken')).toBe(`${SENTINEL}+/=`);
    expect(values.get('isLtiLogin')).toBe('true');
  });

  it('redacts callback secrets from telemetry URLs', () => {
    const callbackUsername = 'student.person@example.edu';
    const redacted = redactAuthCallbackFromUrl(
      `https://ontrack.example/sign_in?authToken=${SENTINEL}&username=${encodeURIComponent(callbackUsername)}#ltik=${SENTINEL}&user_name=${encodeURIComponent(callbackUsername)}`,
    );

    expect(redacted).not.toContain(SENTINEL);
    expect(redacted).not.toContain('student.person');
    expect(redacted).not.toContain(encodeURIComponent(callbackUsername));
    expect(redacted).toContain('%5BFiltered%5D');
  });

  it('redacts inherited SCORM path credentials from telemetry URLs', () => {
    const redacted = redactAuthCallbackFromUrl(
      `https://ontrack.example/api/scorm/42/student/${SENTINEL}/index.html`,
    );

    expect(redacted).not.toContain('student');
    expect(redacted).not.toContain(SENTINEL);
    expect(redacted).toContain('/api/scorm/42/[Filtered]/[Filtered]/index.html');
  });
});
