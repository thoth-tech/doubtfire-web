// MN-C03 targeted SwPush click tests.
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SwPush} from '@angular/service-worker';
import {Subject} from 'rxjs';
import {NOTIFICATION_ROUTE_FALLBACK, NotificationRouteService} from '../notification-route.service';
import {PushNotificationClickService} from '../push-notification-click.service';

describe('PushNotificationClickService', () => {
  let notificationClicks: Subject<unknown>;
  let notificationRoutes: {
    resolve: ReturnType<typeof vi.fn>;
    navigate: ReturnType<typeof vi.fn>;
  };
  let appDocument: {hasFocus: ReturnType<typeof vi.fn>};
  let service: PushNotificationClickService;

  beforeEach(() => {
    notificationClicks = new Subject<unknown>();
    notificationRoutes = {
      resolve: vi.fn((link: unknown) =>
        typeof link === 'string' && link.startsWith('/projects/')
          ? link
          : NOTIFICATION_ROUTE_FALLBACK,
      ),
      navigate: vi.fn().mockResolvedValue(true),
    };
    appDocument = {hasFocus: vi.fn().mockReturnValue(true)};
    const swPush = {
      notificationClicks: notificationClicks.asObservable(),
    } as unknown as SwPush;

    service = new PushNotificationClickService(
      swPush,
      notificationRoutes as unknown as NotificationRouteService,
      appDocument as unknown as Document,
    );
  });

  it('routes an open-app click through the shared boundary', () => {
    service.start();

    notificationClicks.next({
      notification: {
        data: {notification_id: 42, link: '/projects/7/dashboard/1.1P'},
      },
    });

    expect(notificationRoutes.resolve).toHaveBeenCalledWith('/projects/7/dashboard/1.1P');
    expect(notificationRoutes.navigate).toHaveBeenCalledWith('/projects/7/dashboard/1.1P');
  });

  it('uses the shared fallback for a missing link', () => {
    service.start();

    notificationClicks.next({notification: {data: {notification_id: 43}}});

    expect(notificationRoutes.resolve).toHaveBeenCalledWith(undefined);
    expect(notificationRoutes.navigate).toHaveBeenCalledWith(NOTIFICATION_ROUTE_FALLBACK);
  });

  it('uses the shared fallback for an unsafe link', () => {
    service.start();

    notificationClicks.next({
      notification: {
        data: {notification_id: 44, link: 'https://example.test/unsafe'},
      },
    });

    expect(notificationRoutes.resolve).toHaveBeenCalledWith('https://example.test/unsafe');
    expect(notificationRoutes.navigate).toHaveBeenCalledWith(NOTIFICATION_ROUTE_FALLBACK);
  });

  it('does not navigate a background tab when another client was focused', () => {
    appDocument.hasFocus.mockReturnValue(false);
    service.start();

    notificationClicks.next({
      notification: {data: {notification_id: 45, link: '/projects/7/groups'}},
    });

    expect(notificationRoutes.navigate).not.toHaveBeenCalled();
  });

  it('subscribes only once when startup calls start more than once', () => {
    service.start();
    service.start();

    notificationClicks.next({
      notification: {data: {notification_id: 46, link: '/projects/7/groups'}},
    });

    expect(notificationRoutes.navigate).toHaveBeenCalledOnce();
  });

  it('suppresses a duplicate delivery of the same click event', () => {
    service.start();
    const event = {
      notification: {data: {notification_id: 47, link: '/projects/7/groups'}},
    };

    notificationClicks.next(event);
    notificationClicks.next(event);

    expect(notificationRoutes.navigate).toHaveBeenCalledOnce();
  });

  it('does not suppress different notifications that share a route', () => {
    service.start();

    notificationClicks.next({
      notification: {data: {notification_id: 48, link: '/projects/7/groups'}},
    });
    notificationClicks.next({
      notification: {data: {notification_id: 49, link: '/projects/7/groups'}},
    });

    expect(notificationRoutes.navigate).toHaveBeenCalledTimes(2);
  });

  it('stops receiving clicks after teardown', () => {
    service.start();
    service.stop();

    notificationClicks.next({
      notification: {data: {notification_id: 50, link: '/projects/7/groups'}},
    });

    expect(notificationRoutes.navigate).not.toHaveBeenCalled();
  });
});
