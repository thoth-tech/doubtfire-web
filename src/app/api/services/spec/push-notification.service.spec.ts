import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {provideHttpClient, withInterceptorsFromDi, withXhr} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {SwPush} from '@angular/service-worker';
import {BehaviorSubject, NEVER, Observable, Subject} from 'rxjs';
import API_URL from 'src/app/config/constants/apiUrl';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {
  PERMISSION_DENIED_INSTRUCTIONS,
  PushNotificationService,
  detectBrowser,
} from '../push-notification.service';

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/test-browser';

/**
 * Let pending promise callbacks run.
 *
 * unsubscribe() ends in from(swPush.unsubscribe()), and that promise settles on
 * the microtask queue, so completion is not observable in the same tick as the
 * http flush. A macrotask drains everything queued behind it.
 */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Enough of a PushSubscription for the service. The real one comes from the
 * browser and cannot be constructed in a test environment.
 */
function fakeSubscription(
  endpoint: string = ENDPOINT,
  p256dh: string = 'BFakePublicKey',
  auth: string = 'FakeAuthSecret',
) {
  return {
    endpoint,
    toJSON: () => ({
      endpoint,
      keys: {p256dh, auth},
    }),
  } as unknown as PushSubscription;
}

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let httpMock: HttpTestingController;
  let subscriptionSubject: BehaviorSubject<PushSubscription | null>;
  let subscriptionChangeSubject: Subject<{
    oldSubscription: PushSubscription | null;
    newSubscription: PushSubscription | null;
  }>;
  let swPush: {
    isEnabled: boolean;
    subscription: Observable<PushSubscription | null>;
    pushSubscriptionChanges: Observable<{
      oldSubscription: PushSubscription | null;
      newSubscription: PushSubscription | null;
    }>;
    requestSubscription: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };
  let constants: {IsPushEnabled: BehaviorSubject<boolean>; VapidPublicKey: BehaviorSubject<string>};

  beforeEach(() => {
    subscriptionSubject = new BehaviorSubject<PushSubscription | null>(null);
    subscriptionChangeSubject = new Subject();

    swPush = {
      isEnabled: true,
      subscription: subscriptionSubject,
      pushSubscriptionChanges: subscriptionChangeSubject,
      requestSubscription: vi.fn().mockResolvedValue(fakeSubscription()),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    };
    constants = {
      IsPushEnabled: new BehaviorSubject<boolean>(true),
      VapidPublicKey: new BehaviorSubject<string>('BTestVapidPublicKey'),
    };

    // jsdom has neither, and the service checks for both.
    vi.stubGlobal('Notification', {permission: 'default'});
    (window as unknown as {PushManager: unknown}).PushManager = class {};

    TestBed.configureTestingModule({
      providers: [
        PushNotificationService,
        {provide: SwPush, useValue: swPush},
        {provide: DoubtfireConstants, useValue: constants},
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(PushNotificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.unstubAllGlobals();
  });

  it('posts the browser registration to the api when subscribing', () => {
    service.subscribe().subscribe();

    // requestSubscription resolves a promise, so the POST is a microtask away.
    return Promise.resolve().then(() => {
      const request = httpMock.expectOne(`${API_URL}/push_subscriptions`);

      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        endpoint: ENDPOINT,
        p256dh: 'BFakePublicKey',
        auth: 'FakeAuthSecret',
      });
      request.flush(null);
    });
  });

  it('asks the browser to subscribe with the key the api supplied', () => {
    service.subscribe().subscribe();

    expect(swPush.requestSubscription).toHaveBeenCalledWith({
      serverPublicKey: 'BTestVapidPublicKey',
    });

    return Promise.resolve().then(() => {
      httpMock.expectOne(`${API_URL}/push_subscriptions`).flush(null);
    });
  });

  it('stores a rotated registration before deleting the old endpoint', () => {
    const oldSubscription = fakeSubscription(`${ENDPOINT}-old`);
    const newSubscription = fakeSubscription(
      `${ENDPOINT}-new`,
      'BRotatedPublicKey',
      'RotatedAuthSecret',
    );

    service.start();
    subscriptionChangeSubject.next({oldSubscription, newSubscription});

    const post = httpMock.expectOne(
      (request) => request.url === `${API_URL}/push_subscriptions` && request.method === 'POST',
    );
    expect(post.request.body).toEqual({
      endpoint: `${ENDPOINT}-new`,
      p256dh: 'BRotatedPublicKey',
      auth: 'RotatedAuthSecret',
    });
    httpMock.expectNone(
      (request) => request.url === `${API_URL}/push_subscriptions` && request.method === 'DELETE',
    );

    post.flush(null);

    const removeOld = httpMock.expectOne(
      (request) => request.url === `${API_URL}/push_subscriptions` && request.method === 'DELETE',
    );
    expect(removeOld.request.params.get('endpoint')).toBe(`${ENDPOINT}-old`);
    removeOld.flush(null);
  });

  it('updates keys in place when rotation keeps the same endpoint', () => {
    const oldSubscription = fakeSubscription();
    const newSubscription = fakeSubscription(ENDPOINT, 'BRotatedPublicKey', 'RotatedAuthSecret');

    service.start();
    subscriptionChangeSubject.next({oldSubscription, newSubscription});

    const post = httpMock.expectOne(
      (request) => request.url === `${API_URL}/push_subscriptions` && request.method === 'POST',
    );
    expect(post.request.body).toEqual({
      endpoint: ENDPOINT,
      p256dh: 'BRotatedPublicKey',
      auth: 'RotatedAuthSecret',
    });
    post.flush(null);

    httpMock.expectNone(
      (request) => request.url === `${API_URL}/push_subscriptions` && request.method === 'DELETE',
    );
  });

  it('keeps listening after one rotated registration fails to reach the api', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    service.start();
    subscriptionChangeSubject.next({
      oldSubscription: fakeSubscription(`${ENDPOINT}-old`),
      newSubscription: fakeSubscription(`${ENDPOINT}-failed`),
    });

    httpMock
      .expectOne(
        (request) => request.url === `${API_URL}/push_subscriptions` && request.method === 'POST',
      )
      .flush('nope', {status: 500, statusText: 'Server Error'});

    subscriptionChangeSubject.next({
      oldSubscription: null,
      newSubscription: fakeSubscription(`${ENDPOINT}-later`),
    });

    const later = httpMock.expectOne(
      (request) => request.url === `${API_URL}/push_subscriptions` && request.method === 'POST',
    );
    expect(later.request.body['endpoint']).toBe(`${ENDPOINT}-later`);
    later.flush(null);

    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('ignores an invalidation when the browser supplies no replacement', () => {
    service.start();
    subscriptionChangeSubject.next({
      oldSubscription: fakeSubscription(),
      newSubscription: null,
    });

    httpMock.expectNone(`${API_URL}/push_subscriptions`);
  });

  it('starts the rotation listener only once and stops it on teardown', () => {
    service.start();
    service.start();

    subscriptionChangeSubject.next({
      oldSubscription: null,
      newSubscription: fakeSubscription(`${ENDPOINT}-once`),
    });

    httpMock.expectOne(`${API_URL}/push_subscriptions`).flush(null);
    service.stop();

    subscriptionChangeSubject.next({
      oldSubscription: null,
      newSubscription: fakeSubscription(`${ENDPOINT}-stopped`),
    });

    httpMock.expectNone(`${API_URL}/push_subscriptions`);
  });

  it('deletes on the api before unsubscribing in the browser', () => {
    subscriptionSubject.next(fakeSubscription());

    service.unsubscribe().subscribe();

    const request = httpMock.expectOne(
      (r) => r.url === `${API_URL}/push_subscriptions` && r.method === 'DELETE',
    );

    // Order matters. Unsubscribing first would throw the endpoint away and leave
    // a row on the api that nothing can ever delete.
    expect(swPush.unsubscribe).not.toHaveBeenCalled();
    expect(request.request.params.get('endpoint')).toBe(ENDPOINT);

    request.flush(null);
    expect(swPush.unsubscribe).toHaveBeenCalled();
  });

  it('does nothing when unsubscribing a browser that was never subscribed', () => {
    subscriptionSubject.next(null);

    service.unsubscribe().subscribe();

    expect(swPush.unsubscribe).not.toHaveBeenCalled();
    httpMock.expectNone(`${API_URL}/push_subscriptions`);
  });

  it('returns immediately when the service worker is disabled', () => {
    swPush.isEnabled = false;
    swPush.subscription = NEVER;
    let emitted = false;

    service.unsubscribe().subscribe(() => {
      emitted = true;
    });

    expect(emitted).toBe(true);
    expect(swPush.unsubscribe).not.toHaveBeenCalled();
    httpMock.expectNone(`${API_URL}/push_subscriptions`);
  });

  // Leaving the browser subscribed because the api call failed is the worse of
  // the two outcomes. The row on the server is cleaned up when the push service
  // returns 410 for it; a browser still receiving is not cleaned up by anything.
  it('still unsubscribes locally when the api delete fails', async () => {
    subscriptionSubject.next(fakeSubscription());
    let completed = false;

    service.unsubscribe().subscribe({complete: () => (completed = true)});

    const request = httpMock.expectOne(
      (r) => r.url === `${API_URL}/push_subscriptions` && r.method === 'DELETE',
    );
    request.flush('nope', {status: 500, statusText: 'Server Error'});

    expect(swPush.unsubscribe).toHaveBeenCalled();

    // swPush.unsubscribe() returns a promise, so completion lands a tick later.
    await flushMicrotasks();
    expect(completed).toBe(true);
  });

  it('still unsubscribes locally when the api is unreachable', () => {
    subscriptionSubject.next(fakeSubscription());

    service.unsubscribe().subscribe();

    const request = httpMock.expectOne(
      (r) => r.url === `${API_URL}/push_subscriptions` && r.method === 'DELETE',
    );
    request.error(new ProgressEvent('network error'));

    expect(swPush.unsubscribe).toHaveBeenCalled();
  });

  // Sign out calls this and cannot do anything useful with a failure, so it
  // must never throw, even when the browser itself refuses to unsubscribe.
  it('unsubscribeQuietly swallows a failure from the browser', async () => {
    subscriptionSubject.next(fakeSubscription());
    swPush.unsubscribe.mockRejectedValue(new Error('no service worker'));
    let errored = false;
    let completed = false;

    service.unsubscribeQuietly().subscribe({
      error: () => (errored = true),
      complete: () => (completed = true),
    });

    httpMock
      .expectOne((r) => r.url === `${API_URL}/push_subscriptions` && r.method === 'DELETE')
      .flush(null);

    await flushMicrotasks();
    expect(errored).toBe(false);
    expect(completed).toBe(true);
  });

  it('reports nothing blocking when the service worker is running and keys are set', () => {
    expect(service.blocker()).toBeNull();
  });

  it('reports the service worker as the blocker during the first six seconds', () => {
    swPush.isEnabled = false;

    expect(service.blocker()).toBe('no-service-worker');
  });

  it('reports a blocker when the api has no vapid keys', () => {
    constants.IsPushEnabled.next(false);

    expect(service.blocker()).toBe('not-configured');
  });

  it('reports a blocker when the user has denied notifications', () => {
    vi.stubGlobal('Notification', {permission: 'denied'});

    expect(service.blocker()).toBe('permission-denied');
  });

  it('reports a blocker when the browser cannot do push at all', () => {
    delete (window as unknown as {PushManager?: unknown}).PushManager;

    expect(service.blocker()).toBe('unsupported');
  });

  describe('detectBrowser', () => {
    it('recognises Chrome', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      expect(detectBrowser(ua)).toBe('chrome');
    });

    it('recognises Edge even though its user agent also contains Chrome', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      expect(detectBrowser(ua)).toBe('edge');
    });

    it('recognises Firefox', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';
      expect(detectBrowser(ua)).toBe('firefox');
    });

    it('uses the generic fallback for Opera even though its user agent contains Chrome', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0';

      expect(detectBrowser(ua)).toBe('other');
    });

    it('falls back to other for an unrecognised browser', () => {
      expect(detectBrowser('SomeUnknownBrowser/1.0')).toBe('other');
    });
  });

  describe('permissionDeniedInstructions', () => {
    it('returns Chrome steps in Chrome', () => {
      vi.stubGlobal('navigator', {userAgent: 'Chrome/120.0.0.0'});
      expect(service.permissionDeniedInstructions()).toEqual(PERMISSION_DENIED_INSTRUCTIONS.chrome);
    });

    it('returns Edge steps in Edge', () => {
      vi.stubGlobal('navigator', {userAgent: 'Chrome/120.0.0.0 Edg/120.0.0.0'});
      expect(service.permissionDeniedInstructions()).toEqual(PERMISSION_DENIED_INSTRUCTIONS.edge);
    });

    it('returns Firefox steps in Firefox', () => {
      vi.stubGlobal('navigator', {userAgent: 'Firefox/120.0'});
      expect(service.permissionDeniedInstructions()).toEqual(
        PERMISSION_DENIED_INSTRUCTIONS.firefox,
      );
    });

    it('returns generic steps in Opera', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
      });

      expect(service.permissionDeniedInstructions()).toEqual(PERMISSION_DENIED_INSTRUCTIONS.other);
    });

    it('returns generic steps in an unrecognised browser', () => {
      vi.stubGlobal('navigator', {userAgent: 'SomeUnknownBrowser/1.0'});
      expect(service.permissionDeniedInstructions()).toEqual(PERMISSION_DENIED_INSTRUCTIONS.other);
    });
  });
});
