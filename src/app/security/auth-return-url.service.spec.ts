import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AuthReturnUrlService, normaliseAuthReturnUrl} from './auth-return-url.service';

describe('AuthReturnUrlService', () => {
  let service: AuthReturnUrlService;

  beforeEach(() => {
    sessionStorage.clear();
    service = new AuthReturnUrlService();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('restores a protected route exactly once after authentication', () => {
    const target = '/projects/2/dashboard/1.1P/feedback?source=push#latest';

    expect(service.remember(target)).toBe(true);
    expect(service.consume()).toBe(target);
    expect(service.consume()).toBeNull();
  });

  it('survives a full-page SSO round trip in the same tab', () => {
    const target = '/projects/2/dashboard/1.1P/feedback';
    service.remember(target);

    // A new root service instance represents the application booting again
    // after the identity provider redirects back to /sign_in.
    const serviceAfterSsoCallback = new AuthReturnUrlService();

    expect(serviceAfterSsoCallback.consume()).toBe(target);
  });

  it.each([
    'https://evil.example/projects/2',
    '//evil.example/projects/2',
    '/\\evil.example/projects/2',
    '/sign_in?returnUrl=%2Fprojects%2F2',
    '/timeout',
    '/welcome',
    '/lti',
    '/lti/link',
  ])('rejects unsafe or auth-loop destination %s', (target) => {
    expect(service.remember(target)).toBe(false);
    expect(service.consume()).toBeNull();
  });

  it.each([
    '/projects/2?authToken=secret',
    '/projects/2#auth_token=secret',
    '/projects/2#ltiToken=secret&ltik=launch',
  ])('does not persist callback credentials from %s', (target) => {
    expect(service.remember(target)).toBe(false);
  });

  it('normalises only same-origin application paths', () => {
    expect(normaliseAuthReturnUrl('/notifications?filter=unread', 'https://ontrack.example')).toBe(
      '/notifications?filter=unread',
    );
    expect(
      normaliseAuthReturnUrl('https://ontrack.example/notifications', 'https://ontrack.example'),
    ).toBeNull();
  });

  it('clears a pending destination on explicit sign out', () => {
    service.remember('/projects/2/dashboard/1.1P/feedback');

    service.clear();

    expect(new AuthReturnUrlService().consume()).toBeNull();
  });

  it('drops a stale destination instead of surprising a later login', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    service.remember('/projects/2/dashboard/1.1P/feedback');
    clock.mockReturnValue(1_000 + 30 * 60 * 1000 + 1);

    expect(service.consume()).toBeNull();
  });

  it('drops a stored destination with a non-finite timestamp', () => {
    sessionStorage.setItem(
      'doubtfire_auth_return_url',
      '{"url":"/projects/2/dashboard/1.1P/feedback","capturedAt":1e999}',
    );

    expect(service.consume()).toBeNull();
  });
});
