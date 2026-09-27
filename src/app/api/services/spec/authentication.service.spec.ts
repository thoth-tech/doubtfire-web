import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {provideHttpClient, withInterceptorsFromDi, withXhr} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {Subject, of, throwError} from 'rxjs';
import {User, UserService} from 'src/app/api/models/doubtfire-model';
import {AlertService} from 'src/app/common/services/alert.service';
import {FeedbackDraftStore} from 'src/app/common/services/feedback-draft-store.service';
import {ThemeService} from 'src/app/common/theme/theme.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {DemoScenarioRegistryService} from 'src/app/demo/demo-scenario-registry.service';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {AuthReturnUrlService} from 'src/app/security/auth-return-url.service';
import {provideAppInjectorForTests} from 'src/app/testing/app-injector-stub';
import {AuthenticationService, REFRESH_TOKEN_TIMEOUT_MS} from '../authentication.service';
import {NotificationFeedbackRouteIntentService} from '../notification-feedback-route-intent.service';
import {NotificationService} from '../notification.service';
import {PushNotificationService} from '../push-notification.service';

const API_URL = 'http://localhost:3000/api';
const AUTH_URL = `${API_URL}/auth`;

/**
 * Sign out has to drop this browser's push registration, otherwise the next
 * person to sign in on a shared machine keeps receiving the previous user's
 * notifications. These tests pin that behaviour at the sign out boundary:
 * push is torn down while the token is still valid, and a failure tearing it
 * down never traps the user signed in.
 *
 * The push tear down itself (DELETE /push_subscriptions then the browser
 * unsubscribe, and the "never throw" wrapper) is covered in
 * push-notification.service.spec.ts. Here PushNotificationService is a mock so
 * these tests only describe what AuthenticationService.signOut does with it.
 */
describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let httpMock: HttpTestingController;

  let pushService: {unsubscribeQuietly: ReturnType<typeof vi.fn>};
  let notificationService: {reset: ReturnType<typeof vi.fn>};
  let notificationFeedbackIntents: {clear: ReturnType<typeof vi.fn>};
  let demoMode: {reset: ReturnType<typeof vi.fn>};
  let themeService: {
    connectAccount: ReturnType<typeof vi.fn>;
    disconnectAccount: ReturnType<typeof vi.fn>;
  };
  let demoScenarioRegistry: {
    loadForAuthenticatedUser: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let globalState: {
    clearUnitsAndProjects: ReturnType<typeof vi.fn>;
    hideHeader: ReturnType<typeof vi.fn>;
    setView: ReturnType<typeof vi.fn>;
    loadGlobals: ReturnType<typeof vi.fn>;
  };
  let userService: {
    currentUser: Partial<User>;
    anonymousUser: Partial<User>;
    updateThemePreference: ReturnType<typeof vi.fn>;
    cache: {
      clear: ReturnType<typeof vi.fn>;
      getOrCreate: ReturnType<typeof vi.fn>;
    };
  };
  let router: {navigateByUrl: ReturnType<typeof vi.fn>};
  let authReturnUrl: {
    rememberCurrentUrl: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let constants: {
    API_URL: string;
    SignoutURL: string | undefined;
    applyAuthenticatedSettings: ReturnType<typeof vi.fn>;
    resetAuthenticatedSettings: ReturnType<typeof vi.fn>;
  };

  // signOut resolves PushNotificationService, GlobalStateService and
  // NotificationService through AppInjector rather than the constructor (its
  // comment explains this avoids a circular dependency). Each test registers its
  // fresh mocks with the shared spec stand-in, which throws for any token it was
  // not given: a token nobody registered means signOut grew a dependency these
  // tests do not know about, and a stub that quietly answered undefined would turn
  // that into a confusing failure somewhere else.

  beforeEach(() => {
    pushService = {unsubscribeQuietly: vi.fn().mockReturnValue(of(void 0))};
    notificationService = {reset: vi.fn()};
    notificationFeedbackIntents = {clear: vi.fn()};
    demoMode = {reset: vi.fn()};
    themeService = {connectAccount: vi.fn(), disconnectAccount: vi.fn()};
    demoScenarioRegistry = {
      loadForAuthenticatedUser: vi.fn().mockReturnValue(of(void 0)),
      clear: vi.fn(),
    };
    globalState = {
      clearUnitsAndProjects: vi.fn(),
      hideHeader: vi.fn(),
      setView: vi.fn(),
      loadGlobals: vi.fn(),
    };

    const anonymousUser: Partial<User> = {authenticationToken: undefined};
    userService = {
      currentUser: {id: 1, username: 'user-a', authenticationToken: 'token-for-user-a'},
      anonymousUser,
      updateThemePreference: vi.fn((user: Partial<User>, preference: string) =>
        of({
          ...user,
          themePreference: preference,
          themePreferenceUpdatedAt: '2026-09-01T00:00:00Z',
        }),
      ),
      cache: {
        clear: vi.fn(),
        getOrCreate: vi.fn((id: number, _service: UserService, data: object) => ({
          ...data,
          id,
        })),
      },
    };
    router = {navigateByUrl: vi.fn()};
    authReturnUrl = {rememberCurrentUrl: vi.fn(), clear: vi.fn()};
    constants = {
      API_URL,
      SignoutURL: undefined,
      applyAuthenticatedSettings: vi.fn(),
      resetAuthenticatedSettings: vi.fn(),
    };

    provideAppInjectorForTests([
      [PushNotificationService, pushService],
      [GlobalStateService, globalState],
      [NotificationService, notificationService],
      [NotificationFeedbackRouteIntentService, notificationFeedbackIntents],
    ]);

    TestBed.configureTestingModule({
      providers: [
        AuthenticationService,
        {provide: UserService, useValue: userService as unknown as UserService},
        {provide: Router, useValue: router},
        {provide: AlertService, useValue: {error: vi.fn()}},
        {provide: DoubtfireConstants, useValue: constants},
        {provide: DemoModeStore, useValue: demoMode},
        {provide: DemoScenarioRegistryService, useValue: demoScenarioRegistry},
        {provide: AuthReturnUrlService, useValue: authReturnUrl},
        {provide: ThemeService, useValue: themeService},
        {provide: FeedbackDraftStore, useValue: {clearUser: vi.fn()}},
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AuthenticationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  const authResponse = (id: number, token: string) => ({
    user: {
      id,
      username: `user-${id}`,
      systemRole: 'Student',
      hasRunFirstTimeSetup: true,
    },
    auth_token: token,
    auth_token_expiry: '2099-01-01T00:00:00Z',
  });

  const authenticatedSettings = {
    overseerEnabled: true,
    tiiEnabled: true,
    d2lEnabled: false,
    pushEnabled: true,
    vapidPublicKey: 'BCurrentVapidKey',
  };

  // The shared computer case. The push registration belongs to whoever enabled
  // it and the browser keeps it across sign out, so it has to be dropped while
  // the token is still valid. DELETE /push_subscriptions needs that token, which
  // is why the unsubscribe must finish before the token is deleted.
  it('unsubscribes from push before the auth token is deleted', () => {
    // Hold the unsubscribe open so we can prove the token is not deleted first.
    const unsubscribeGate: Subject<void> = new Subject();
    pushService.unsubscribeQuietly.mockReturnValue(unsubscribeGate);

    service.signOut();

    expect(pushService.unsubscribeQuietly).toHaveBeenCalledTimes(1);
    expect(constants.resetAuthenticatedSettings).toHaveBeenCalledTimes(1);
    // The token is still needed for the push delete, so it must not be gone yet.
    httpMock.expectNone((r) => r.url === AUTH_URL && r.method === 'DELETE');

    // Unsubscribe finishes, and only now may the token go.
    unsubscribeGate.next();
    unsubscribeGate.complete();

    const tokenDelete = httpMock.expectOne((r) => r.url === AUTH_URL && r.method === 'DELETE');
    expect(tokenDelete.request.params.get('remember')).toBe('false');
    tokenDelete.flush(null);

    // The browser is signed out now, so the next person starts unsubscribed.
    expect(userService.currentUser).toBe(userService.anonymousUser);

    // Same shared machine problem, other half of it. The push registration is
    // gone but NotificationService is a root singleton, so its cache and unread
    // count would otherwise survive into the next person's session.
    expect(notificationService.reset).toHaveBeenCalledTimes(1);
    expect(notificationFeedbackIntents.clear).toHaveBeenCalledTimes(1);
    expect(demoMode.reset).toHaveBeenCalledTimes(1);
    expect(demoScenarioRegistry.clear).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(FeedbackDraftStore).clearUser).toHaveBeenCalledWith(1);
    expect(themeService.disconnectAccount).toHaveBeenCalledTimes(1);
    expect(authReturnUrl.clear).toHaveBeenCalledTimes(1);
  });

  // unsubscribeQuietly is the "never throw" variant, and sign out is also wired
  // to continue on error. Either way a failed unsubscribe must not leave the
  // user stuck signed in.
  it('still completes sign out when the push unsubscribe fails', () => {
    pushService.unsubscribeQuietly.mockReturnValue(
      throwError(() => new Error('push unsubscribe failed')),
    );

    service.signOut();

    // The failure did not stop the token being deleted or the user signing out.
    httpMock.expectOne((r) => r.url === AUTH_URL && r.method === 'DELETE').flush(null);

    expect(userService.currentUser).toBe(userService.anonymousUser);
  });

  // With no one signed in there is no subscription tied to a user and no token,
  // so signing out must not call push or the auth api at all.
  it('does not touch push or the token when no user is signed in', () => {
    userService.currentUser = {authenticationToken: undefined};

    service.signOut();

    expect(pushService.unsubscribeQuietly).not.toHaveBeenCalled();
    expect(constants.resetAuthenticatedSettings).toHaveBeenCalledTimes(1);
    httpMock.expectNone((r) => r.url === AUTH_URL && r.method === 'DELETE');
    expect(userService.currentUser).toBe(userService.anonymousUser);
  });

  it('remembers the current protected route before showing authentication timeout', () => {
    vi.useFakeTimers();
    try {
      service.timeoutAuthentication();

      expect(authReturnUrl.rememberCurrentUrl).toHaveBeenCalledOnce();
      expect(router.navigateByUrl).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/timeout');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not complete sign in until authenticated settings are applied', () => {
    const afterAuth = vi.fn();
    const signInNext = vi.fn();
    service.afterAuthCall(afterAuth);

    service
      .signIn({username: 'user-1', password: 'password', remember: false})
      .subscribe(signInNext);

    httpMock
      .expectOne((r) => r.url === AUTH_URL && r.method === 'POST')
      .flush(authResponse(1, 't1'));

    const settingsRequest = httpMock.expectOne(`${API_URL}/settings`);
    expect(constants.applyAuthenticatedSettings).not.toHaveBeenCalled();
    expect(globalState.loadGlobals).not.toHaveBeenCalled();
    expect(afterAuth).not.toHaveBeenCalled();
    expect(signInNext).not.toHaveBeenCalled();

    settingsRequest.flush(authenticatedSettings);

    expect(constants.applyAuthenticatedSettings).toHaveBeenCalledWith(authenticatedSettings);
    expect(constants.applyAuthenticatedSettings.mock.invocationCallOrder[0]).toBeLessThan(
      globalState.loadGlobals.mock.invocationCallOrder[0],
    );
    expect(afterAuth).toHaveBeenCalledWith(true);
    expect(signInNext).toHaveBeenCalledTimes(1);
  });

  it('connects account theme sync on a real sign in', () => {
    userService.currentUser = userService.anonymousUser;
    const response = authResponse(1, 't1');
    response.user['themePreference'] = 'dark';
    response.user['themePreferenceUpdatedAt'] = '2026-08-31T12:00:00Z';

    service.signIn({username: 'user-1', password: 'password', remember: false}).subscribe();

    httpMock.expectOne((r) => r.url === AUTH_URL && r.method === 'POST').flush(response);
    expect(themeService.connectAccount).toHaveBeenCalledOnce();
    expect(themeService.connectAccount).toHaveBeenCalledWith(
      1,
      'dark',
      '2026-08-31T12:00:00Z',
      expect.any(Function),
    );

    httpMock.expectOne(`${API_URL}/settings`).flush(authenticatedSettings);
  });

  it('reconnects theme sync to the incoming account during overlapping sign ins', () => {
    userService.currentUser = userService.anonymousUser;
    const firstResponse = authResponse(1, 't1');
    const secondResponse = authResponse(2, 't2');

    service.signIn({username: 'user-1', password: 'password', remember: false}).subscribe();
    const firstAuth = httpMock.expectOne(
      (request) => request.url === AUTH_URL && request.body['username'] === 'user-1',
    );
    service.signIn({username: 'user-2', password: 'password', remember: false}).subscribe();
    const secondAuth = httpMock.expectOne(
      (request) => request.url === AUTH_URL && request.body['username'] === 'user-2',
    );

    firstAuth.flush(firstResponse);
    const firstSettings = httpMock.expectOne(`${API_URL}/settings`);
    secondAuth.flush(secondResponse);
    const secondSettings = httpMock.expectOne(`${API_URL}/settings`);

    expect(themeService.connectAccount).toHaveBeenCalledTimes(2);
    expect(themeService.connectAccount.mock.calls[0][0]).toBe(1);
    expect(themeService.connectAccount.mock.calls[1][0]).toBe(2);
    const saveSecondAccount = themeService.connectAccount.mock.calls[1][3];
    saveSecondAccount('dark').subscribe();
    expect(userService.updateThemePreference).toHaveBeenCalledWith(
      expect.objectContaining({id: 2}),
      'dark',
    );

    firstSettings.flush(authenticatedSettings);
    secondSettings.flush(authenticatedSettings);
  });

  it('waits for authenticated settings before reporting a restored session', () => {
    const loginResult = vi.fn();

    service.attemptLoginUsingRefreshToken(loginResult);

    httpMock
      .expectOne((r) => r.url === `${AUTH_URL}/access-token` && r.method === 'POST')
      .flush(authResponse(1, 'refreshed-token'));

    const settingsRequest = httpMock.expectOne(`${API_URL}/settings`);
    expect(loginResult).not.toHaveBeenCalled();

    settingsRequest.flush(authenticatedSettings);

    expect(loginResult).toHaveBeenCalledWith(true);
  });

  it('keeps a refresh cookie retryable when the auth service is unavailable', () => {
    const loginResult = vi.fn();

    service.attemptLoginUsingRefreshToken(loginResult);
    httpMock
      .expectOne(`${AUTH_URL}/access-token`)
      .flush({error: 'unavailable'}, {status: 503, statusText: 'Service Unavailable'});

    expect(loginResult).toHaveBeenCalledWith(false, 'unavailable');
    expect(userService.currentUser).toBe(userService.anonymousUser);
    expect(userService.cache.clear).toHaveBeenCalled();
    expect(pushService.unsubscribeQuietly).not.toHaveBeenCalled();
  });

  it('times out the complete refresh hydration, including protected settings', async () => {
    vi.useFakeTimers();
    const loginResult = vi.fn();
    try {
      service.attemptLoginUsingRefreshToken(loginResult);
      httpMock.expectOne(`${AUTH_URL}/access-token`).flush(authResponse(1, 'refreshed-token'));
      const settingsRequest = httpMock.expectOne(`${API_URL}/settings`);

      await vi.advanceTimersByTimeAsync(REFRESH_TOKEN_TIMEOUT_MS + 1);

      expect(loginResult).toHaveBeenCalledWith(false, 'timeout');
      expect(settingsRequest.cancelled).toBe(true);
      expect(userService.currentUser).toBe(userService.anonymousUser);
      expect(themeService.disconnectAccount).toHaveBeenCalledOnce();
      expect(pushService.unsubscribeQuietly).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears a definitively expired refresh session', () => {
    const loginResult = vi.fn();

    service.attemptLoginUsingRefreshToken(loginResult);
    httpMock
      .expectOne(`${AUTH_URL}/access-token`)
      .flush({error: 'expired'}, {status: 404, statusText: 'Not Found'});

    expect(loginResult).toHaveBeenCalledWith(false, 'expired');
    expect(pushService.unsubscribeQuietly).toHaveBeenCalledOnce();
    httpMock
      .expectOne((request) => request.url === AUTH_URL && request.method === 'DELETE')
      .flush(null);
    expect(userService.currentUser).toBe(userService.anonymousUser);
  });

  it('fails settings closed without rejecting valid credentials', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const afterAuth = vi.fn();
    const signInNext = vi.fn();
    service.afterAuthCall(afterAuth);

    service
      .signIn({username: 'user-1', password: 'password', remember: false})
      .subscribe(signInNext);

    httpMock
      .expectOne((r) => r.url === AUTH_URL && r.method === 'POST')
      .flush(authResponse(1, 't1'));
    httpMock.expectOne(`${API_URL}/settings`).flush(
      {error: 'unavailable'},
      {
        status: 500,
        statusText: 'Server Error',
      },
    );

    expect(constants.resetAuthenticatedSettings).toHaveBeenCalledTimes(1);
    expect(constants.applyAuthenticatedSettings).not.toHaveBeenCalled();
    expect(globalState.loadGlobals).toHaveBeenCalledTimes(1);
    expect(afterAuth).toHaveBeenCalledWith(true);
    expect(signInNext).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
  });

  it('cancels pending settings and authentication completion when sign out starts', () => {
    const afterAuth = vi.fn();
    const signInNext = vi.fn();
    service.afterAuthCall(afterAuth);

    service
      .signIn({username: 'user-1', password: 'password', remember: false})
      .subscribe(signInNext);

    httpMock
      .expectOne((r) => r.url === AUTH_URL && r.method === 'POST')
      .flush(authResponse(1, 't1'));
    const settingsRequest = httpMock.expectOne(`${API_URL}/settings`);

    service.signOut(false);

    expect(authReturnUrl.clear).not.toHaveBeenCalled();
    expect(settingsRequest.cancelled).toBe(true);
    expect(constants.resetAuthenticatedSettings).toHaveBeenCalledTimes(1);
    expect(constants.applyAuthenticatedSettings).not.toHaveBeenCalled();
    expect(globalState.loadGlobals).not.toHaveBeenCalled();
    expect(afterAuth).not.toHaveBeenCalled();
    expect(signInNext).not.toHaveBeenCalled();

    httpMock.expectOne((r) => r.url === AUTH_URL && r.method === 'DELETE').flush(null);
  });

  it('cancels pending demo hydration before sign-out can complete authentication', () => {
    const demoResponse: Subject<void> = new Subject();
    demoScenarioRegistry.loadForAuthenticatedUser.mockReturnValue(demoResponse.asObservable());
    const signInNext = vi.fn();
    const afterAuth = vi.fn();
    service.afterAuthCall(afterAuth);
    service
      .signIn({username: 'user-1', password: 'password', remember: false})
      .subscribe(signInNext);
    httpMock
      .expectOne((r) => r.url === AUTH_URL && r.method === 'POST')
      .flush(authResponse(1, 't1'));
    httpMock.expectOne(`${API_URL}/settings`).flush(authenticatedSettings);
    expect(demoResponse.observed).toBe(true);

    service.signOut(false);
    expect(demoResponse.observed).toBe(false);
    demoResponse.next();
    demoResponse.complete();

    expect(globalState.loadGlobals).not.toHaveBeenCalled();
    expect(afterAuth).not.toHaveBeenCalled();
    expect(signInNext).not.toHaveBeenCalled();
    httpMock.expectOne((r) => r.url === AUTH_URL && r.method === 'DELETE').flush(null);
  });

  it('does not let an older account demo response complete a newer sign-in', () => {
    const firstDemoResponse: Subject<void> = new Subject();
    demoScenarioRegistry.loadForAuthenticatedUser.mockReturnValueOnce(
      firstDemoResponse.asObservable(),
    );
    const firstSignInNext = vi.fn();
    const secondSignInNext = vi.fn();
    service
      .signIn({username: 'user-1', password: 'password', remember: false})
      .subscribe(firstSignInNext);
    httpMock
      .expectOne((r) => r.url === AUTH_URL && r.method === 'POST')
      .flush(authResponse(1, 't1'));
    httpMock.expectOne(`${API_URL}/settings`).flush(authenticatedSettings);
    const mayPublishFirstScenario = demoScenarioRegistry.loadForAuthenticatedUser.mock.calls[0][1];
    expect(mayPublishFirstScenario()).toBe(true);

    service
      .signIn({username: 'user-2', password: 'password', remember: false})
      .subscribe(secondSignInNext);
    httpMock
      .expectOne((r) => r.url === AUTH_URL && r.method === 'POST')
      .flush(authResponse(2, 't2'));
    expect(mayPublishFirstScenario()).toBe(false);
    firstDemoResponse.next();
    firstDemoResponse.complete();
    expect(firstSignInNext).not.toHaveBeenCalled();
    expect(globalState.loadGlobals).not.toHaveBeenCalled();

    httpMock.expectOne(`${API_URL}/settings`).flush(authenticatedSettings);
    expect(secondSignInNext).toHaveBeenCalledOnce();
    expect(globalState.loadGlobals).toHaveBeenCalledOnce();
  });

  it('does not complete from an older settings response for the same user', () => {
    const afterAuth = vi.fn();
    const firstSignInNext = vi.fn();
    const secondSignInNext = vi.fn();
    service.afterAuthCall(afterAuth);

    service
      .signIn({username: 'user-1', password: 'password', remember: false})
      .subscribe(firstSignInNext);
    httpMock
      .expectOne((r) => r.url === AUTH_URL && r.method === 'POST')
      .flush(authResponse(1, 't1'));
    const firstSettingsRequest = httpMock.expectOne(`${API_URL}/settings`);

    service
      .signIn({username: 'user-1', password: 'password', remember: false})
      .subscribe(secondSignInNext);
    httpMock
      .expectOne((r) => r.url === AUTH_URL && r.method === 'POST')
      .flush(authResponse(1, 't2'));
    const secondSettingsRequest = httpMock.expectOne(`${API_URL}/settings`);

    firstSettingsRequest.flush({...authenticatedSettings, vapidPublicKey: 'BStaleKey'});

    expect(constants.applyAuthenticatedSettings).not.toHaveBeenCalled();
    expect(globalState.loadGlobals).not.toHaveBeenCalled();
    expect(afterAuth).not.toHaveBeenCalled();
    expect(firstSignInNext).not.toHaveBeenCalled();

    secondSettingsRequest.flush(authenticatedSettings);

    expect(constants.applyAuthenticatedSettings).toHaveBeenCalledOnce();
    expect(constants.applyAuthenticatedSettings).toHaveBeenCalledWith(authenticatedSettings);
    expect(afterAuth).toHaveBeenCalledWith(true);
    expect(secondSignInNext).toHaveBeenCalledTimes(1);
  });

  it('does not reset or complete from an older settings failure for the same user', () => {
    const afterAuth = vi.fn();
    const firstSignInNext = vi.fn();
    const secondSignInNext = vi.fn();
    service.afterAuthCall(afterAuth);

    service
      .signIn({username: 'user-1', password: 'password', remember: false})
      .subscribe(firstSignInNext);
    httpMock
      .expectOne((r) => r.url === AUTH_URL && r.method === 'POST')
      .flush(authResponse(1, 't1'));
    const firstSettingsRequest = httpMock.expectOne(`${API_URL}/settings`);

    service
      .signIn({username: 'user-1', password: 'password', remember: false})
      .subscribe(secondSignInNext);
    httpMock
      .expectOne((r) => r.url === AUTH_URL && r.method === 'POST')
      .flush(authResponse(1, 't2'));
    const secondSettingsRequest = httpMock.expectOne(`${API_URL}/settings`);

    firstSettingsRequest.flush(
      {error: 'stale failure'},
      {
        status: 500,
        statusText: 'Server Error',
      },
    );

    expect(constants.resetAuthenticatedSettings).not.toHaveBeenCalled();
    expect(globalState.loadGlobals).not.toHaveBeenCalled();
    expect(afterAuth).not.toHaveBeenCalled();
    expect(firstSignInNext).not.toHaveBeenCalled();

    secondSettingsRequest.flush(authenticatedSettings);

    expect(constants.applyAuthenticatedSettings).toHaveBeenCalledWith(authenticatedSettings);
    expect(afterAuth).toHaveBeenCalledWith(true);
    expect(secondSignInNext).toHaveBeenCalledTimes(1);
  });
});
