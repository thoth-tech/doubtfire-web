import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Router} from '@angular/router';
import {
  AsyncSubject,
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  map,
  of,
  switchMap,
  takeUntil,
  tap,
  throwError,
} from 'rxjs';
import {User, UserService} from 'src/app/api/models/doubtfire-model';
import {NotificationService} from 'src/app/api/services/notification.service';
import {PushNotificationService} from 'src/app/api/services/push-notification.service';
import {AppInjector} from 'src/app/app-injector';
import {AlertService} from 'src/app/common/services/alert.service';
import {
  type AuthenticatedSettingsResponseFormat,
  DoubtfireConstants,
} from 'src/app/config/constants/doubtfire-constants';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {GlobalStateService, ViewType} from 'src/app/projects/states/index/global-state.service';
import {buildAuthCallbackFragment} from 'src/app/security/auth-callback';
import {AuthReturnUrlService} from 'src/app/security/auth-return-url.service';

/**
 * The format for the data returned from the auth api.
 */
interface AuthResponse {
  user: object;
  auth_token: string;
  auth_token_expiry: string;
  lti_token?: string;
}

@Injectable()
export class AuthenticationService {
  /**
   * The URL for the authentication API endpoint
   */
  private readonly AUTH_URL: string;

  /**
   * The key used to store the username in local storage - now removed.
   */
  public readonly USERNAME_KEY: string = 'doubtfire_user';

  /**
   * The key used to store the remember me option in local storage.
   */
  public readonly REMEMBER_DOUBTFIRE_CREDENTIALS_TOKEN: string =
    'remember_doubtfire_credentials_token';

  /**
   * AsyncSubject to indicate when the authentication process is complete.
   */
  private authComplete$: AsyncSubject<boolean> = new AsyncSubject<boolean>();

  /**
   * Cancels a protected settings request as soon as sign out starts. A plain
   * Subject is intentional: requests created by a later session must not see a
   * previous session's cancellation event.
   */
  private authenticatedSettingsCancellation$: Subject<void> = new Subject<void>();

  /**
   * Changes on sign out so a response belonging to an earlier session cannot
   * publish settings or complete authentication for the current session.
   */
  private authenticationGeneration = 0;

  /**
   * Only the newest settings response for the current session may update the
   * singleton constants. Token refresh can legitimately overlap a prior read.
   */
  private authenticatedSettingsRequestId = 0;

  constructor(
    private httpClient: HttpClient,
    private userService: UserService,
    private alertService: AlertService,
    private angularRouter: Router,
    private doubtfireConstants: DoubtfireConstants,
    private demoMode: DemoModeStore,
    private authReturnUrl: AuthReturnUrlService,
  ) {
    this.AUTH_URL = `${this.doubtfireConstants.API_URL}/auth`;
    // Ensure any only user data is removed from local storage
    this.browserStorage?.removeItem(this.USERNAME_KEY);
  }

  private actionAuthFailed() {
    this.authReturnUrl.rememberCurrentUrl();
    this.signOut(false);
  }

  /**
   * Attempt to login using the refresh token secure cookie.
   * This requires the remember option to be true - and the server to have sent a
   * secure cookie.
   * @param loginResultCallback - Callback function to indicate success or failure of login.
   */
  public attemptLoginUsingRefreshToken(
    loginResultCallback: (result: boolean) => void,
    firstTime: boolean = true,
  ): void {
    // Check we have indication of secure cookie in local storage
    const remember: boolean = this.rememberMe;

    if (!remember) {
      loginResultCallback(false);
      return;
    }

    const authenticationGeneration = this.authenticationGeneration;

    // Attempt to get an access token using the refresh token cookie
    this.httpClient.post(this.AUTH_URL + '/access-token', {}).subscribe({
      next: (response: AuthResponse | null) => {
        if (authenticationGeneration !== this.authenticationGeneration) {
          return;
        }

        if (response && response.auth_token) {
          this.setupUserFromResponse(response, firstTime, authenticationGeneration).subscribe({
            next: () => loginResultCallback(true),
            error: () => {
              this.actionAuthFailed();
              loginResultCallback(false);
            },
          });
        } else {
          this.actionAuthFailed();
          loginResultCallback(false);
        }
      },
      error: (_error) => {
        if (authenticationGeneration !== this.authenticationGeneration) {
          return;
        }

        // Will occur on 404 when the refresh token cookie is not present
        this.actionAuthFailed();
        loginResultCallback(false);
      },
    });
  }

  /**
   * Check if the user is authenticated.
   *
   * @returns true if the user is authenticated, false otherwise.
   */
  public isAuthenticated(): boolean {
    return (
      this.userService.currentUser.id !== undefined &&
      !!this.userService.currentUser.authenticationToken
    );
  }

  public get rememberMe(): boolean {
    return this.browserStorage?.getItem(this.REMEMBER_DOUBTFIRE_CREDENTIALS_TOKEN) !== 'false';
  }

  public set rememberMe(remember: boolean) {
    this.browserStorage?.setItem(
      this.REMEMBER_DOUBTFIRE_CREDENTIALS_TOKEN,
      remember ? 'true' : 'false',
    );
  }

  private get browserStorage(): Storage | null {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get a new access token - and delete the old one.
   *
   * @returns void
   */
  private cycleAccessToken() {
    const remember: boolean = this.rememberMe;

    // We cant get a new token if there is no refresh token cookie
    if (!this.isAuthenticated() || !remember) {
      return;
    }

    // Attempt to get a new access token using the refresh token cookie
    this.attemptLoginUsingRefreshToken((result: boolean) => {
      if (result) {
        console.log('Successfully refreshed access token');
      }
    });
  }

  private readonly validRoles: string[] = [
    'anon',
    'Student',
    'Tutor',
    'Convenor',
    'Admin',
    'Auditor',
  ];

  private isValidRoleWhitelist(roleWhitelist: string[]) {
    return roleWhitelist.filter((role: string) => this.validRoles.includes(role)).length !== 0;
  }

  public isAuthorised(roleWhitelist: string[], role?: string): boolean {
    if (!role) {
      role = this.userService.currentUser.role;
    }

    return (
      roleWhitelist.length > 0 &&
      this.isValidRoleWhitelist(roleWhitelist) &&
      roleWhitelist.includes(role)
    );
  }

  private isCurrentAuthentication(userId: number, authenticationGeneration: number): boolean {
    return (
      authenticationGeneration === this.authenticationGeneration &&
      userId === this.userService.currentUser.id &&
      !!this.userService.currentUser.authenticationToken
    );
  }

  private loadAuthenticatedSettings(
    userId: number,
    authenticationGeneration: number,
  ): Observable<void> {
    const url: string = `${this.doubtfireConstants.API_URL}/settings`;
    const requestId = ++this.authenticatedSettingsRequestId;

    return this.httpClient.get<AuthenticatedSettingsResponseFormat>(url).pipe(
      takeUntil(this.authenticatedSettingsCancellation$),
      switchMap((settings) => {
        if (
          !this.isCurrentAuthentication(userId, authenticationGeneration) ||
          requestId !== this.authenticatedSettingsRequestId
        ) {
          return EMPTY;
        }

        this.doubtfireConstants.applyAuthenticatedSettings(settings);

        return of(void 0);
      }),
      catchError((error) => {
        if (
          !this.isCurrentAuthentication(userId, authenticationGeneration) ||
          requestId !== this.authenticatedSettingsRequestId
        ) {
          return EMPTY;
        }

        // A failed settings read must not leave a previous session's feature
        // flags or VAPID key active. Stale overlapping requests return above and
        // cannot reset or publish authentication readiness.
        this.doubtfireConstants.resetAuthenticatedSettings();
        console.error('Unable to load authenticated settings', error);

        // Settings are fail closed, but their availability must not turn valid
        // credentials into a failed sign in.
        return of(void 0);
      }),
    );
  }

  /**
   * Use the user service to get or create a user object, and update it
   * from the response. Ensure that the authentication token is set.
   *
   * @param response the response from the authentication API
   */
  private setupUserFromResponse(
    response: AuthResponse,
    firstTime: boolean = true,
    authenticationGeneration: number = this.authenticationGeneration,
  ): Observable<void> {
    // Extract relevant data from response and construct user object to store in cache.
    const user: User = this.userService.cache.getOrCreate(
      response.user['id'],
      this.userService,
      response.user,
    );

    // Set the user's authentication token for access to api.
    user.authenticationToken = response['auth_token'];
    user.authenticationTokenExpiry = response['auth_token_expiry'];

    // Record the current user
    this.userService.currentUser = user;

    // Feature flags are part of authentication readiness. Consumers use their
    // current values synchronously, so do not load globals, publish authComplete
    // or complete signIn until this authenticated request has settled.
    return this.loadAuthenticatedSettings(user.id, authenticationGeneration).pipe(
      tap(() => {
        if (firstTime) {
          // Load everything!
          AppInjector.get(GlobalStateService).loadGlobals();
          // Update token in one hour
          setTimeout(() => this.cycleAccessToken(), 1000 * 60 * 60);
        }

        // Indicate that authentication and its protected settings are ready.
        this.authComplete$.next(true);
        this.authComplete$.complete();
      }),
    );
  }

  /**
   * Register a callback to be called when the authentication process is complete.
   * This is used by the runtime.coffee for now to check authorisation after login
   * completes. The callback will be called with true if user is authorised and if
   * not will redirect to another page.
   *
   * @param callback the callback function to call
   */
  public afterAuthCall(callback: (result: boolean) => void): Subscription {
    return this.authComplete$.subscribe({
      next: (result) => {
        callback(result);
      },
    });
  }

  public signIn(
    userCredentials:
      | {
          username: string;
          password: string;
          remember: boolean;
        }
      | {
          auth_token: string;
          username: string;
          remember: boolean;
        },
  ): Observable<void> {
    const authenticationGeneration = this.authenticationGeneration;

    return this.httpClient.post(this.AUTH_URL, userCredentials).pipe(
      switchMap((response: AuthResponse) =>
        authenticationGeneration === this.authenticationGeneration
          ? this.setupUserFromResponse(response, true, authenticationGeneration)
          : EMPTY,
      ),
      catchError((error) => {
        // this.authComplete$.next(false);
        // this.authComplete$.complete();

        return throwError(() => error);
      }),
    );
  }

  public signInWithLti(userCredentials: {ltik: string; lti_token: string}): Observable<void> {
    return this.httpClient.post(`${this.AUTH_URL}/lti`, userCredentials).pipe(
      map((response: AuthResponse) => {
        const fragment = buildAuthCallbackFragment({
          username: response.user['username'],
          authToken: response.auth_token,
          ltik: userCredentials.ltik,
          isLtiLogin: true,
        });
        setTimeout(() => {
          window.location.href = `/sign_in#${fragment}`;
        });
      }),
      catchError((error) => {
        return throwError(() => error);
      }),
    );
  }

  // Removes this user's unsent comment drafts from browser storage, along with
  // any left over from before drafts were scoped to a user, which belong to
  // nobody and would otherwise sit there for good.
  //
  // Keys are collected first and deleted afterwards. Calling removeItem inside a
  // forward loop over localStorage.key(i) shifts the indices along and skips
  // every second match.
  private clearCommentDrafts(userId?: number): void {
    const draftPrefix = 'task_comment_draft_';
    const userPrefix = userId ? `${draftPrefix}uid${userId}_` : null;

    try {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(draftPrefix)) {
          continue;
        }
        // This user's drafts, and the old unscoped keys which have a task id
        // straight after the prefix rather than a user id.
        if ((userPrefix && key.startsWith(userPrefix)) || !this.isUserScopedDraftKey(key)) {
          doomed.push(key);
        }
      }
      doomed.forEach((key) => localStorage.removeItem(key));
    } catch (e) {
      console.error('Error clearing comment drafts:', e);
    }

    try {
      if (userId) {
        sessionStorage.removeItem(`task_comments_submitted_${userId}`);
      }
      sessionStorage.removeItem('task_comments_submitted');
    } catch (e) {
      console.error('Error clearing submitted comment tasks:', e);
    }
  }

  // A scoped key is task_comment_draft_uid<userId>_<rest>. Anything else under
  // the prefix was written before drafts were scoped to a user, belongs to
  // nobody, and nothing will ever read it again. A legacy key starts with a task
  // or project id, or the literal 'unknown', so it can never begin with uid
  // followed by digits.
  private isUserScopedDraftKey(key: string): boolean {
    const rest = key.substring('task_comment_draft_'.length);
    return /^uid\d+_/.test(rest);
  }

  public signOut(ssoSignOut = true): void {
    if (ssoSignOut) {
      this.authReturnUrl.clear();
    }

    this.demoMode.reset();

    // Invalidate authentication work before the asynchronous push and token
    // teardown. This prevents a late /settings response from restoring values
    // after sign out or completing an obsolete sign-in observable.
    this.authenticationGeneration += 1;
    this.authenticatedSettingsRequestId += 1;
    this.authenticatedSettingsCancellation$.next();
    this.doubtfireConstants.resetAuthenticatedSettings();

    // This function is called after the token is deleted...
    const doSignOut = () => {
      // Setup ability to auth again
      this.authComplete$.complete();
      this.authComplete$ = new AsyncSubject<boolean>();

      // Unsent comment drafts live in browser storage and sign out routes rather
      // than reloading, so nothing else drops them. Clear them before the current
      // user is replaced, otherwise the prefix is built from the anonymous user
      // and nothing matches.
      this.clearCommentDrafts(this.userService.currentUser?.id);

      // Change the current user to the anonymous user
      this.userService.currentUser = this.userService.anonymousUser;

      // Clear global state
      const globalStateService = AppInjector.get(GlobalStateService);
      globalStateService.clearUnitsAndProjects();
      this.userService.cache.clear();

      // Notifications are per user and NotificationService is a root singleton,
      // so its cache and unread count outlive the session. Sign out routes
      // rather than reloading, so nothing else drops them and the next person on
      // a shared machine would see this user's messages.
      AppInjector.get(NotificationService).reset();

      // Trigger the UI changes
      globalStateService.hideHeader();
      globalStateService.setView(ViewType.OTHER);

      // if we have a signout URL, redirect to it
      if (ssoSignOut && this.doubtfireConstants.SignoutURL) {
        window.location.assign(this.doubtfireConstants.SignoutURL);
      } else {
        this.angularRouter.navigateByUrl('/sign_in');
      }
    };

    // If we have a token, delete it...
    const deleteTokenAndSignOut = () => {
      if (this.userService.currentUser.authenticationToken) {
        this.httpClient.delete(this.AUTH_URL, {params: {remember: false}}).subscribe({
          next: (_response) => doSignOut(),
          error: (_response) => doSignOut(),
        });
      } else {
        doSignOut();
      }
    };

    // Drop the push registration before the auth token goes.
    //
    // The subscription belongs to whoever enabled it, and the browser keeps it
    // across sign out. On a shared machine that means the next person to sign in
    // would keep receiving the previous user's notifications on this device.
    //
    // Order matters twice over. DELETE /push_subscriptions needs the token, so
    // it has to run first, and sign out must never be blocked by it, so both
    // outcomes continue. Resolved through AppInjector rather than the
    // constructor to avoid a circular dependency, the same as GlobalStateService
    // above.
    if (this.userService.currentUser.authenticationToken) {
      AppInjector.get(PushNotificationService)
        .unsubscribeQuietly()
        .subscribe({
          next: () => deleteTokenAndSignOut(),
          error: () => deleteTokenAndSignOut(),
        });
    } else {
      deleteTokenAndSignOut();
    }
  }

  public timeoutAuthentication(): void {
    if (window.location.pathname !== '/timeout') {
      this.authReturnUrl.rememberCurrentUrl();
      this.alertService.error('Authentication timed out', 6000);
      setTimeout(() => this.angularRouter.navigateByUrl('/timeout'), 500);
    }
  }

  public getScormToken(): Observable<string> {
    return this.httpClient.get(this.AUTH_URL + '/scorm').pipe(
      map((response) => {
        return response['scorm_auth_token'];
      }),
    );
  }
}
