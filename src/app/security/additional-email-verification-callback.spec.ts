import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  captureAndScrubAdditionalEmailVerification,
  consumeAdditionalEmailVerificationToken,
  redactAdditionalEmailVerificationFromUrl,
} from './additional-email-verification-callback';

describe('additional email verification callback', () => {
  beforeEach(() => {
    // Other specs in the same worker can leave history state behind.
    globalThis.history?.replaceState(null, '');
    consumeAdditionalEmailVerificationToken();
  });

  it('captures the fragment token once and scrubs it before startup', () => {
    const replaceState = vi.fn();

    captureAndScrubAdditionalEmailVerification(
      'https://ontrack.example/verify_additional_email#token=private-token',
      replaceState,
    );

    expect(replaceState).toHaveBeenCalledWith(null, '', '/verify_additional_email');
    expect(consumeAdditionalEmailVerificationToken()).toBe('private-token');
    expect(consumeAdditionalEmailVerificationToken()).toBeNull();
  });

  it('disables telemetry and drops the token when browser history cannot be scrubbed', () => {
    const safe = captureAndScrubAdditionalEmailVerification(
      'https://ontrack.example/verify_additional_email#token=private-token',
      () => {
        throw new Error('History denied');
      },
    );
    expect(safe).toBe(false);
    expect(consumeAdditionalEmailVerificationToken()).toBeNull();
  });

  it('returns an unsafe result for malformed URLs without interrupting startup', () => {
    expect(captureAndScrubAdditionalEmailVerification('invalid URL', vi.fn())).toBe(false);
    expect(consumeAdditionalEmailVerificationToken()).toBeNull();
  });

  it('scrubs unsupported query tokens without treating them as verification credentials', () => {
    const replaceState = vi.fn();
    expect(
      captureAndScrubAdditionalEmailVerification(
        'https://ontrack.example/verify_additional_email?token=query-secret',
        replaceState,
      ),
    ).toBe(true);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/verify_additional_email');
    expect(consumeAdditionalEmailVerificationToken()).toBeNull();
  });

  it('redacts verification tokens from defensive telemetry URL handling', () => {
    const redacted = redactAdditionalEmailVerificationFromUrl(
      'https://ontrack.example/verify_additional_email?token=query-secret#token=fragment-secret',
    );
    expect(redacted).not.toContain('query-secret');
    expect(redacted).not.toContain('fragment-secret');
    expect(redacted).toContain('Filtered');
  });

  it('ignores a token on every other route', () => {
    const replaceState = vi.fn();

    captureAndScrubAdditionalEmailVerification(
      'https://ontrack.example/home#token=not-for-this-handler',
      replaceState,
    );

    expect(replaceState).not.toHaveBeenCalled();
    expect(consumeAdditionalEmailVerificationToken()).toBeNull();
  });
});
