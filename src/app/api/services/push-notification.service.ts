import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {SwPush} from '@angular/service-worker';
import {
  Observable,
  Subscription,
  catchError,
  concatMap,
  from,
  map,
  of,
  switchMap,
  take,
} from 'rxjs';
import API_URL from 'src/app/config/constants/apiUrl';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';

/**
 * Why the browser cannot be subscribed to push right now, or null if it can.
 */
export type PushBlocker =
  | 'no-service-worker'
  | 'not-configured'
  | 'permission-denied'
  | 'unsupported';

/**
 * Browsers we have specific unblock instructions for. 'other' covers Safari,
 * Opera, and anything else — a generic fallback still gets shown.
 */
export type SupportedBrowser = 'chrome' | 'edge' | 'firefox' | 'other';

/**
 * Which browser the user agent string identifies as.
 *
 * Order matters: Edge's user agent also contains "Chrome/", and older Opera
 * builds do too, so the more specific token has to be checked first or every
 * Edge user gets Chrome's instructions.
 */
export function detectBrowser(userAgent: string): SupportedBrowser {
  const ua = userAgent.toLowerCase();

  if (ua.includes('edg/')) {
    return 'edge';
  }

  if (ua.includes('firefox/')) {
    return 'firefox';
  }

  if (ua.includes('opr/') || ua.includes('opt/') || ua.includes('opera/')) {
    return 'other';
  }

  if (ua.includes('chrome/')) {
    return 'chrome';
  }

  return 'other';
}

/**
 * Step-by-step instructions for reversing a blocked notification permission,
 * per browser. A site cannot re-prompt once denied — only the user can undo
 * it, in their own browser's settings.
 */
export const PERMISSION_DENIED_INSTRUCTIONS: Record<SupportedBrowser, string[]> = {
  chrome: [
    'Click the lock (or tune) icon to the left of the address bar.',
    'Select "Site settings".',
    'Set Notifications to "Allow".',
    'Reload this page.',
  ],
  edge: [
    'Click the lock icon to the left of the address bar.',
    'Select "Permissions for this site".',
    'Set Notifications to "Allow".',
    'Reload this page.',
  ],
  firefox: [
    'Click the lock icon to the left of the address bar.',
    'Select "More Information", then the Permissions tab.',
    'Clear the blocked Notifications permission and set it to "Allow".',
    'Reload this page.',
  ],
  other: [
    "Open this site's permissions from your browser's address bar menu.",
    'Find Notifications and set it to "Allow".',
    'Reload this page.',
  ],
};

@Injectable({providedIn: 'root'})
export class PushNotificationService {
  private readonly endpoint = `${API_URL}/push_subscriptions`;
  private subscriptionChangeSubscription: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private swPush: SwPush,
    private constants: DoubtfireConstants,
  ) {}

  /**
   * Emits the current subscription, or null when this browser is not subscribed.
   *
   * The service worker registers six seconds after bootstrap
   * (doubtfire-angular.module.ts), so this is null on load and then changes.
   * Subscribe to it rather than reading it once.
   */
  public get subscription$(): Observable<PushSubscription | null> {
    return this.swPush.subscription;
  }

  /**
   * Whether the service worker is running. False in a build without it, and
   * false for the first six seconds of every page load.
   */
  public get isEnabled(): boolean {
    return this.swPush.isEnabled;
  }

  /**
   * What is stopping this browser subscribing, or null if nothing is.
   */
  public blocker(): PushBlocker | null {
    if (typeof Notification === 'undefined' || !('PushManager' in window)) {
      return 'unsupported';
    }
    if (Notification.permission === 'denied') {
      return 'permission-denied';
    }
    if (!this.constants.IsPushEnabled.value || !this.constants.VapidPublicKey.value) {
      return 'not-configured';
    }
    if (!this.swPush.isEnabled) {
      return 'no-service-worker';
    }
    return null;
  }

  /**
   * Which browser this is, based on the user agent. Drives which set of
   * unblock instructions is shown.
   */
  public get browser(): SupportedBrowser {
    return detectBrowser(typeof navigator !== 'undefined' ? navigator.userAgent : '');
  }

  /**
   * Step-by-step instructions for this browser to reverse a blocked
   * notification permission. Only meaningful when blocker() returned
   * 'permission-denied'; callers should check that first.
   */
  public permissionDeniedInstructions(): string[] {
    return PERMISSION_DENIED_INSTRUCTIONS[this.browser];
  }

  /**
   * Keep the api registration in step with browser-driven subscription changes.
   *
   * Angular 22 forwards the service worker's `pushsubscriptionchange` event as
   * `pushSubscriptionChanges`. Register the replacement before removing the old
   * endpoint so a transient api failure cannot throw away the last server row.
   */
  public start(): void {
    if (this.subscriptionChangeSubscription) {
      return;
    }

    this.subscriptionChangeSubscription = this.swPush.pushSubscriptionChanges
      .pipe(
        concatMap(({oldSubscription, newSubscription}) => {
          if (!newSubscription) {
            // Some browsers can report invalidation without a replacement. A
            // fresh subscribe needs a user gesture, so leave recovery to the
            // existing opt-in control and let server delivery remove the dead row.
            return of(void 0);
          }

          return this.registerSubscription(newSubscription).pipe(
            switchMap(() => {
              if (!oldSubscription || oldSubscription.endpoint === newSubscription.endpoint) {
                return of(void 0);
              }

              return this.removeServerSubscription(oldSubscription.endpoint);
            }),
            // One failed sync must not terminate the long-lived rotation stream.
            catchError((error) => {
              console.error('Could not update the rotated push subscription', error);
              return of(void 0);
            }),
          );
        }),
      )
      .subscribe();
  }

  public stop(): void {
    this.subscriptionChangeSubscription?.unsubscribe();
    this.subscriptionChangeSubscription = null;
  }

  /**
   * Ask the browser for permission, then store the resulting registration
   * against the signed in user.
   *
   * Call this from a click and nowhere else. requestSubscription needs an active
   * service worker and a user gesture; called during app init it fails in a way
   * that looks nothing like the real cause.
   */
  public subscribe(): Observable<void> {
    return from(
      this.swPush.requestSubscription({
        serverPublicKey: this.constants.VapidPublicKey.value,
      }),
    ).pipe(switchMap((subscription) => this.registerSubscription(subscription)));
  }

  /**
   * Stop this browser receiving push, both in the browser and on the api.
   *
   * The api call goes first and on purpose: once swPush.unsubscribe() has run
   * the endpoint is gone from this page, and a row nobody can delete would sit
   * there until the push service returned 410 for it.
   */
  public unsubscribe(): Observable<void> {
    // Angular exposes SwPush.subscription as NEVER when service workers are
    // disabled, so waiting on it would prevent sign-out from continuing.
    if (!this.swPush.isEnabled) {
      return of(void 0);
    }

    // take(1) matters. swPush.subscription never completes, so without it the
    // returned observable would stay open forever and re-fire on every change.
    return this.swPush.subscription.pipe(
      take(1),
      switchMap((subscription) => {
        if (!subscription) {
          return of(void 0);
        }

        return this.removeServerSubscription(subscription.endpoint).pipe(
          // Server cleanup failing must not leave the browser subscribed. If
          // the delete fails we still unsubscribe locally: the browser stops
          // receiving immediately, and the row left behind is removed the
          // first time the push service answers 410 for it, which deliver_to
          // in PushNotificationService already handles.
          catchError(() => of(void 0)),
          switchMap(() => from(this.swPush.unsubscribe())),
          map(() => void 0),
        );
      }),
    );
  }

  /**
   * Unsubscribe, but never fail.
   *
   * For sign out, where the caller cannot do anything useful with an error and
   * must not be blocked by one. Prefer unsubscribe() anywhere a person is
   * waiting on the result and should be told it did not work.
   */
  public unsubscribeQuietly(): Observable<void> {
    return this.unsubscribe().pipe(catchError(() => of(void 0)));
  }

  private registerSubscription(subscription: PushSubscription): Observable<void> {
    const keys = subscription.toJSON().keys ?? {};

    return this.http.post<void>(this.endpoint, {
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });
  }

  private removeServerSubscription(endpoint: string): Observable<void> {
    return this.http.delete<void>(this.endpoint, {params: {endpoint}});
  }
}
