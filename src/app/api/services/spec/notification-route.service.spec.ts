// MN-C03 targeted route-boundary tests.
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Router} from '@angular/router';
import {AuthReturnUrlService} from 'src/app/security/auth-return-url.service';
import {AuthenticationService} from '../authentication.service';
import {NOTIFICATION_ROUTE_FALLBACK, NotificationRouteService} from '../notification-route.service';

describe('NotificationRouteService', () => {
  let router: {url: string; navigateByUrl: ReturnType<typeof vi.fn>};
  let authentication: {isAuthenticated: ReturnType<typeof vi.fn>};
  let authReturnUrl: {remember: ReturnType<typeof vi.fn>};
  let service: NotificationRouteService;

  beforeEach(() => {
    router = {
      url: '/home',
      navigateByUrl: vi.fn().mockResolvedValue(true),
    };
    authentication = {isAuthenticated: vi.fn().mockReturnValue(true)};
    authReturnUrl = {remember: vi.fn()};
    service = new NotificationRouteService(
      router as unknown as Router,
      authentication as unknown as AuthenticationService,
      authReturnUrl as unknown as AuthReturnUrlService,
    );
  });

  it('accepts each approved notification route family', () => {
    const approved = [
      '/notifications',
      '/projects/1/dashboard',
      '/projects/23/groups',
      '/projects/23/dashboard/1.1P',
      '/projects/23/dashboard/1.1P/feedback',
      '/projects/23/dashboard/T1.1',
      '/projects/23/dashboard/HD1.2',
      '/projects/23/dashboard/10.1H',
      '/projects/23/dashboard/A15',
      '/projects/23/dashboard/TASK1',
      '/projects/23/dashboard/P-2.21',
      '/projects/23/dashboard/D-9.568',
      '/projects/23/dashboard/C-4.602',
    ];

    for (const route of approved) {
      expect(service.resolve(route)).toBe(route);
    }
  });

  it('uses the safe fallback for missing and malformed values', () => {
    const invalid: unknown[] = [
      undefined,
      null,
      42,
      {},
      '',
      ' ',
      ' /projects/1/dashboard',
      '/projects/1/dashboard ',
      '/projects/0/dashboard',
      '/projects/-1/dashboard',
      '/projects/1//dashboard',
      '/projects/1/dashboard/',
      '/projects/1/dashboard/1.1P/extra',
      '/projects/1/dashboard/1.1P/feedback/extra',
      '/projects/1/dashboard/line\nbreak',
      `/projects/1/dashboard/${'A1'.repeat(20)}`,
    ];

    for (const value of invalid) {
      expect(service.resolve(value)).toBe(NOTIFICATION_ROUTE_FALLBACK);
    }
  });

  it('rejects absolute, external, scheme and protocol-relative destinations', () => {
    const invalid = [
      'http://example.test/projects/1/dashboard',
      'https://example.test/projects/1/dashboard',
      'mailto:student@example.test',
      'javascript:alert(1)',
      'data:text/html,unsafe',
      'file:///etc/passwd',
      '//example.test/projects/1/dashboard',
      '\\example.test\\projects\\1',
      '/\\example.test/projects/1',
      '/projects\\1\\dashboard',
    ];

    for (const value of invalid) {
      expect(service.resolve(value)).toBe(NOTIFICATION_ROUTE_FALLBACK);
    }
  });

  it('rejects encoded bypass attempts rather than decoding them', () => {
    const invalid = [
      '/%2f%2fexample.test',
      '/%5cexample.test',
      '/projects/1/dashboard/%31.1P',
      '/projects/1/dashboard/1.1P%3ftoken%3dsecret',
      '/projects/1/dashboard/1.1P%23feedback',
      '/%252f%252fexample.test',
      '/projects/1/dashboard/%00',
      '/projects/1/dashboard/%',
    ];

    for (const value of invalid) {
      expect(service.resolve(value)).toBe(NOTIFICATION_ROUTE_FALLBACK);
    }
  });

  it('rejects unexpected route families, queries and fragments', () => {
    const invalid = [
      '/home',
      '/units/1',
      '/projects/1',
      '/projects/1/portfolio',
      '/projects/1/dashboard/1.1P?token=secret',
      '/projects/1/dashboard/1.1P#feedback',
      '/notifications?student=Alice',
    ];

    for (const value of invalid) {
      expect(service.resolve(value)).toBe(NOTIFICATION_ROUTE_FALLBACK);
    }
  });

  it('accepts bounded task segments without guessing their business format', () => {
    const approved = [
      '/projects/1/dashboard/85',
      '/projects/1/dashboard/Alice1',
      '/projects/1/dashboard/BOB1',
      '/projects/1/dashboard/1.1ALICE',
      '/projects/1/dashboard/1.1BOB',
      '/projects/1/dashboard/feedback1',
      '/projects/1/dashboard/token123',
      '/projects/1/dashboard/mark85',
    ];

    for (const route of approved) {
      expect(service.resolve(route)).toBe(route);
    }
  });

  it('navigates an open app through Angular Router', async () => {
    await expect(service.navigate('/projects/23/dashboard/1.1P')).resolves.toBe(true);

    expect(router.navigateByUrl).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/projects/23/dashboard/1.1P');
  });

  it('navigates unsafe input to the safe fallback', async () => {
    await service.navigate('https://example.test/steal');

    expect(router.navigateByUrl).toHaveBeenCalledWith(NOTIFICATION_ROUTE_FALLBACK);
  });

  it('saves an allow-listed target before sending an anonymous client to sign in', async () => {
    authentication.isAuthenticated.mockReturnValue(false);
    const target = '/projects/23/dashboard/1.1P/feedback';

    await service.navigate(target);

    expect(authReturnUrl.remember).toHaveBeenCalledWith(target);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/sign_in');
  });

  it('never saves an unvalidated notification destination', async () => {
    authentication.isAuthenticated.mockReturnValue(false);

    await service.navigate('https://evil.example/steal');

    expect(authReturnUrl.remember).toHaveBeenCalledWith(NOTIFICATION_ROUTE_FALLBACK);
    expect(authReturnUrl.remember).not.toHaveBeenCalledWith('https://evil.example/steal');
  });

  it('does not navigate twice when a closed-app launch already opened the target', async () => {
    router.url = '/projects/23/dashboard/1.1P?from=service-worker#top';

    await expect(service.navigate('/projects/23/dashboard/1.1P')).resolves.toBe(true);

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('does not re-navigate the fallback when notifications is already open', async () => {
    router.url = '/notifications';

    await service.navigate(undefined);

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
