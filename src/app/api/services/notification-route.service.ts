// MN-C03: one security boundary for every notification destination.
import {Injectable} from '@angular/core';
import {Router} from '@angular/router';
import {AuthReturnUrlService} from 'src/app/security/auth-return-url.service';
import {AuthenticationService} from './authentication.service';

export const NOTIFICATION_ROUTE_FALLBACK = '/notifications';

const MAX_NOTIFICATION_ROUTE_LENGTH = 256;
const CONTROL_CHARACTER_MAX = 0x1f;
const DELETE_CHARACTER = 0x7f;
const FORBIDDEN_ROUTE_TEXT = /[\s\\?#%]/;
const PROJECT_ROOT_ROUTE = /^\/projects\/[1-9]\d*\/(?:dashboard|groups)$/;
const PROJECT_TASK_ROUTE =
  /^\/projects\/[1-9]\d*\/dashboard\/[A-Za-z0-9][A-Za-z0-9._-]{0,31}(?:\/feedback)?$/;

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
    const target = this.resolve(link);

    // A service-worker click can reach an already-open anonymous client after
    // the one-off startup authentication check has finished. Save the already
    // allow-listed notification target and enter the normal sign-in flow now,
    // rather than waiting for a protected request to fail.
    if (!this.authentication.isAuthenticated()) {
      this.authReturnUrl.remember(target);
      if (this.currentPath() === '/sign_in') {
        return Promise.resolve(true);
      }
      return this.router.navigateByUrl('/sign_in');
    }

    if (this.currentPath() === target) {
      return Promise.resolve(true);
    }
    return this.router.navigateByUrl(target);
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
