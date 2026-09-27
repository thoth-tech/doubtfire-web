// MN-C03: one security boundary for every notification destination.
import {Injectable} from '@angular/core';
import {Router} from '@angular/router';
import {AuthReturnUrlService} from 'src/app/security/auth-return-url.service';
import {AuthenticationService} from './authentication.service';
import {
  NotificationFeedbackRouteIntent,
  NotificationFeedbackRouteIntentService,
} from './notification-feedback-route-intent.service';

export const NOTIFICATION_ROUTE_FALLBACK = '/notifications';

const MAX_NOTIFICATION_ROUTE_LENGTH = 256;
const CONTROL_CHARACTER_MAX = 0x1f;
const DELETE_CHARACTER = 0x7f;
const FORBIDDEN_ROUTE_TEXT = /[\s\\?#%]/;
const PROJECT_ROOT_ROUTE = /^\/projects\/[1-9]\d*\/(?:dashboard|groups)$/;
const PROJECT_TASK_ROUTE =
  /^\/projects\/[1-9]\d*\/dashboard\/[A-Za-z0-9][A-Za-z0-9._-]{0,31}(?:\/feedback)?$/;
// The one destination allowed a query string, and only as two numeric ids.
const UNIT_HUB_ROUTE = /^\/unit-hub\?unit=[1-9]\d{0,9}&(?:announcement|session)=[1-9]\d{0,9}$/;
const PROJECT_FEEDBACK_ROUTE =
  /^\/projects\/([1-9]\d*)\/dashboard\/([A-Za-z0-9][A-Za-z0-9._-]{0,31})\/feedback$/;

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const characterCode = character.charCodeAt(0);
    return characterCode <= CONTROL_CHARACTER_MAX || characterCode === DELETE_CHARACTER;
  });
}

@Injectable({providedIn: 'root'})
export class NotificationRouteService {
  constructor(
    private router: Router,
    private authentication: AuthenticationService,
    private authReturnUrl: AuthReturnUrlService,
    private feedbackIntents?: NotificationFeedbackRouteIntentService,
  ) {}

  public resolve(link: unknown): string {
    if (typeof link !== 'string') {
      return NOTIFICATION_ROUTE_FALLBACK;
    }
    if (link.length === 0 || link.length > MAX_NOTIFICATION_ROUTE_LENGTH) {
      return NOTIFICATION_ROUTE_FALLBACK;
    }
    if (link !== link.trim()) {
      return NOTIFICATION_ROUTE_FALLBACK;
    }
    if (!link.startsWith('/') || link.startsWith('//')) {
      return NOTIFICATION_ROUTE_FALLBACK;
    }
    if (UNIT_HUB_ROUTE.test(link)) {
      return link;
    }
    if (hasControlCharacters(link) || FORBIDDEN_ROUTE_TEXT.test(link)) {
      return NOTIFICATION_ROUTE_FALLBACK;
    }

    if (link === NOTIFICATION_ROUTE_FALLBACK || PROJECT_ROOT_ROUTE.test(link)) {
      return link;
    }

    if (!PROJECT_TASK_ROUTE.test(link)) {
      return NOTIFICATION_ROUTE_FALLBACK;
    }

    return link;
  }

  public navigate(link: unknown): Promise<boolean> {
    return this.navigateToTarget(this.resolve(link));
  }

  /**
   * Go to an in-app url that was built here from ids, not taken from a link.
   *
   * NotificationTargetService builds these with the router from numeric ids and
   * a task abbreviation the router encodes, so there is no raw text to screen
   * and the allow-list above, which only knows the api's link shapes, would
   * turn away the staff pages it needs.
   */
  public navigateToTarget(target: string): Promise<boolean> {
    const feedbackIntent = this.createFeedbackIntent(target);

    // A service-worker click can reach an already-open anonymous client after
    // the one-off startup authentication check has finished. Save the already
    // allow-listed notification target and enter the normal sign-in flow now,
    // rather than waiting for a protected request to fail.
    if (!this.authentication.isAuthenticated()) {
      this.authReturnUrl.remember(target);
      if (this.currentPath() === '/sign_in') {
        return Promise.resolve(true);
      }
      return this.finishNavigation(this.router.navigateByUrl('/sign_in'), feedbackIntent);
    }

    if (this.currentPath() === target) {
      return Promise.resolve(true);
    }
    return this.finishNavigation(this.router.navigateByUrl(target), feedbackIntent);
  }

  private createFeedbackIntent(target: string): NotificationFeedbackRouteIntent | null {
    if (!this.feedbackIntents) {
      return null;
    }

    // A later notification click supersedes any earlier route intent, including
    // one waiting behind sign-in. This prevents an old task from revealing when
    // a different destination eventually resolves.
    this.feedbackIntents.clear();

    const match = target.match(PROJECT_FEEDBACK_ROUTE);
    if (!match) {
      return null;
    }

    return this.feedbackIntents.request({
      projectId: Number(match[1]),
      taskAbbreviation: match[2],
    });
  }

  private async finishNavigation(
    navigation: Promise<boolean>,
    feedbackIntent: NotificationFeedbackRouteIntent | null,
  ): Promise<boolean> {
    try {
      const navigated = await navigation;
      if (!navigated && feedbackIntent) {
        this.feedbackIntents?.cancel(feedbackIntent);
      }
      return navigated;
    } catch (error) {
      if (feedbackIntent) {
        this.feedbackIntents?.cancel(feedbackIntent);
      }
      throw error;
    }
  }

  private currentPath(): string {
    const routerUrl = typeof this.router.url === 'string' ? this.router.url : '/';
    const withoutFragment = routerUrl.split('#', 1)[0];
    const withoutQuery = withoutFragment.split('?', 1)[0];
    if (!withoutQuery) {
      return '/';
    }
    return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : withoutQuery;
  }
}
