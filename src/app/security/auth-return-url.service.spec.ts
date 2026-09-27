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

  it('keeps a one-use in-memory destination when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    expect(service.remember('/projects/2/dashboard')).toBe(true);
    expect(service.consume()).toBe('/projects/2/dashboard');
    expect(service.consume()).toBeNull();
  });

  it.each(['not-json', 'null', '[]', '{"url":42,"capturedAt":1000}'])(
    'ignores corrupt stored state %s after a page reload',
    (stored) => {
      sessionStorage.setItem('doubtfire_auth_return_url', stored);
      expect(new AuthReturnUrlService().consume()).toBeNull();
      expect(sessionStorage.getItem('doubtfire_auth_return_url')).toBeNull();
    },
  );

  it('rejects a future timestamp and removes it permanently', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    sessionStorage.setItem(
      'doubtfire_auth_return_url',
      JSON.stringify({url: '/projects/2', capturedAt: 2_000}),
    );
    expect(service.consume()).toBeNull();
    expect(service.consume()).toBeNull();
  });

  it('accepts a return at the expiry boundary but rejects it one millisecond later', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    service.remember('/projects/2');
    now.mockReturnValue(1_000 + 30 * 60 * 1_000);
    expect(service.consume()).toBe('/projects/2');

    now.mockReturnValue(1_000);
    service.remember('/projects/2');
    now.mockReturnValue(1_001 + 30 * 60 * 1_000);
    expect(service.consume()).toBeNull();
  });
});
