import { Injectable, inject, APP_INITIALIZER, Provider } from '@angular/core';
import { Router, UrlSegment, Route, CanMatchFn } from '@angular/router';
import { Observable, of, merge } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AuthenticationService } from 'src/app/api/services/authentication.service';
import { UserService } from 'src/app/api/services/user.service';

export const roleGuard: CanMatchFn = (route: Route, segments: UrlSegment[]) => {
  const auth = inject(AuthenticationService);

  // Checking whitelist
  const whitelist = (route.data?.['roleWhitelist'] as string[] | undefined) ?? [];

  // No restriction => allow
  if (!Array.isArray(whitelist) || whitelist.length === 0) {
    return true;
  }

  // Checking inf authorised for the destination
  if (safeIsAuthorised(auth, whitelist)) {
    return true;
  }

  // Not authorised: compute intended hash-path for AngularJS, redirect to /#/login, and block match.
  const attemptedPath = '/' + segments.map(s => s.path).join('/');
  redirectToNg1Login(attemptedPath);
  return false; // cancel Angular navigation; Ng1 will take over
};

type AuthEvent = { type: 'tokenTimeout' | 'unauthorisedRequestIntercepted' };

@Injectable({ providedIn: 'root' })
export class RuntimeService {
  constructor(
    private router: Router,
    private auth: AuthenticationService,
    private users: UserService
  ) {

    const streams: Observable<any>[] = [];

    // Generic event bus with typed events (preferred)
    const maybeEvents$ = (this.auth as any)?.events$ as Observable<AuthEvent> | undefined;
    if (maybeEvents$) {
      streams.push(
        maybeEvents$.pipe(
          filter(e => e?.type === 'tokenTimeout' || e?.type === 'unauthorisedRequestIntercepted')
        )
      );
    }

    // Dedicated streams
    const tokenTimeout$ = (this.auth as any)?.tokenTimeout$ as Observable<void> | undefined;
    if (tokenTimeout$) streams.push(tokenTimeout$);
    const unauth$ = (this.auth as any)?.unauthorised$ as Observable<void> | undefined;
    if (unauth$) streams.push(unauth$);

    // If nothing exists yet, keep a no-op observable so subscribe() is safe.
    if (streams.length === 0) streams.push(of(null));

    merge(...streams).subscribe(() => {
      this.handleInvalidOrMissingToken();
    });
  }
   //Redirect to AngularJS login when token is invalid/expired, preserving where we were.
   //Coffee: handleUnauthorised + handleTokenTimeout + serialize()
  private handleInvalidOrMissingToken(): void {
    // Avoid loops if already on the AngularJS login route
    const hash = window.location.hash || '';
    if (hash.startsWith('#/login') || hash.includes('#/login?')) {
      return;
    }

    // Best effort: clear session state if AuthenticationService exposes it
    try { (this.auth as any)?.logout?.(); } catch {}

    // Build returnUrl as the current hash path (AngularJS route), falling back to Angular URL if empty
    const currentHashPath = (hash.startsWith('#') ? hash.slice(1) : hash) || this.router.url || '/';
    redirectToNg1Login(currentHashPath);
  }
}

export function provideRuntime(): Provider {
  const init = (runtime: RuntimeService) => () => {
  };
  return {
    provide: APP_INITIALIZER,
    useFactory: init,
    deps: [RuntimeService],
    multi: true,
  };
}

// Defensive wrapper in for variable AuthenticationService.
function safeIsAuthorised(auth: AuthenticationService, whitelist: string[]): boolean {
  try {
    const fn: any = (auth as any)?.isAuthorised;
    if (typeof fn === 'function') return !!fn.call(auth, whitelist);
  } catch {}
  return false;
}

// Redirect to the AngularJS login route, preserving a returnUrl hash-path.
function redirectToNg1Login(returnPath: string): void {
  // Ensure returnPath starts with a slash; include any query the Ng1 route may need
  const path = returnPath.startsWith('/') ? returnPath : `/${returnPath}`;
  const loginUrl = `/#/login?returnUrl=${encodeURIComponent(path)}`;
  window.location.assign(loginUrl);
}
