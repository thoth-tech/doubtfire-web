import {EntityCache} from 'ngx-entity-service';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {BreakpointObserver} from '@angular/cdk/layout';
import {TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {Subject, of} from 'rxjs';
import {
  CampusService,
  LearningOutcomeService,
  Project,
  ProjectService,
  TeachingPeriodService,
  Unit,
  UnitRole,
  UnitRoleService,
  UnitService,
  UserService,
} from 'src/app/api/models/doubtfire-model';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {FeedbackTemplateService} from 'src/app/api/services/feedback-template.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {AuthReturnUrlService} from 'src/app/security/auth-return-url.service';
import {GlobalStateService, STARTUP_TIMEOUT_MS} from './global-state.service';

type RefreshCallback = Parameters<AuthenticationService['attemptLoginUsingRefreshToken']>[0];

describe('GlobalStateService startup', () => {
  let service: GlobalStateService;
  let createService: () => GlobalStateService;
  let originalUrl: string;
  let authCallback: RefreshCallback;
  let authentication: {
    attemptLoginUsingRefreshToken: ReturnType<typeof vi.fn>;
    isAuthenticated: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
  let campuses: Subject<unknown[]>;
  let teachingPeriods: Subject<unknown[]>;
  let unitRoles: Subject<unknown[]>;
  let projects: Subject<unknown[]>;
  let campusService: {query: ReturnType<typeof vi.fn>};
  let teachingPeriodService: {query: ReturnType<typeof vi.fn>};
  let unitRoleService: {cache: object; query: ReturnType<typeof vi.fn>};
  let projectService: {cache: object; query: ReturnType<typeof vi.fn>};
  let router: {navigateByUrl: ReturnType<typeof vi.fn>};

  beforeEach(() => {
    originalUrl = window.location.href;
    window.history.replaceState(null, '', '/home');
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    campuses = new Subject();
    teachingPeriods = new Subject();
    unitRoles = new Subject();
    projects = new Subject();
    campusService = {query: vi.fn(() => campuses.asObservable())};
    teachingPeriodService = {query: vi.fn(() => teachingPeriods.asObservable())};
    unitRoleService = {cache: emptyCache(), query: vi.fn(() => unitRoles.asObservable())};
    projectService = {cache: emptyCache(), query: vi.fn(() => projects.asObservable())};
    router = {navigateByUrl: vi.fn()};
    authentication = {
      attemptLoginUsingRefreshToken: vi.fn((callback: RefreshCallback) => {
        authCallback = callback;
      }),
      isAuthenticated: vi.fn(() => true),
      signOut: vi.fn(),
    };

    createService = () =>
      new GlobalStateService(
        unitRoleService as never,
        {cache: emptyCache()} as never,
        {currentUser: {isStaff: false, hasRunFirstTimeSetup: true}, cache: emptyCache()} as never,
        authentication as never,
        projectService as never,
        campusService as never,
        teachingPeriodService as never,
        {query: vi.fn()} as never,
        {query: vi.fn()} as never,
        router as never,
        {error: vi.fn()} as never,
        {isMatched: vi.fn(() => false)} as never,
        {rememberCurrentUrl: vi.fn()} as never,
      );
    service = createService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    service.ngOnDestroy();
    window.history.replaceState(null, '', originalUrl);
  });

  it('opens the public verification page without session restoration or a loading overlay', () => {
    service.ngOnDestroy();
    authentication.attemptLoginUsingRefreshToken.mockClear();
    window.history.replaceState(null, '', '/verify_additional_email');
    service = createService();

    expect(authentication.attemptLoginUsingRefreshToken).not.toHaveBeenCalled();
    expect(service.isLoadingSubject.value).toBe(false);
    expect(service.startupStateSubject.value.status).toBe('signed-out');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('still redirects a signed-out protected page to sign-in', () => {
    authCallback(false, 'not-requested');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/sign_in');
    expect(service.isLoadingSubject.value).toBe(false);
  });

  it('removes serial project loading and the artificial final delay', () => {
    service.loadGlobals();
    expect(unitRoleService.query).not.toHaveBeenCalled();
    expect(projectService.query).not.toHaveBeenCalled();

    campuses.next([]);
    campuses.complete();
    teachingPeriods.next([]);
    teachingPeriods.complete();

    expect(unitRoleService.query).toHaveBeenCalledOnce();
    expect(projectService.query).toHaveBeenCalledOnce();

    unitRoles.next([]);
    unitRoles.complete();
    projects.next([]);
    projects.complete();

    expect(service.startupStateSubject.value.status).toBe('ready');
    expect(service.isLoadingSubject.value).toBe(false);
  });

  it('publishes a recoverable terminal state when a required request fails', () => {
    service.loadGlobals();
    campuses.error(new Error('network failed'));

    expect(service.startupStateSubject.value).toMatchObject({
      status: 'error',
      failedResource: 'campuses',
    });
    expect(service.startupStateSubject.value.message).toContain('campuses');
    expect(service.isLoadingSubject.value).toBe(true);
  });

  it('labels a required-request failure as offline when the browser is offline', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);

    service.loadGlobals();
    campuses.error(new Error('network failed'));

    expect(service.startupStateSubject.value).toMatchObject({
      status: 'offline',
      failedResource: 'campuses',
    });
    expect(service.startupStateSubject.value.message).toContain('offline');
  });

  it('times out an otherwise permanent startup wait', async () => {
    vi.useFakeTimers();
    service.loadGlobals();

    await vi.advanceTimersByTimeAsync(STARTUP_TIMEOUT_MS + 1);

    expect(service.startupStateSubject.value.status).toBe('error');
    expect(service.startupStateSubject.value.message).toContain('taking longer than expected');
  });

  it('retries refresh-token hydration without routing away after a transient failure', () => {
    authCallback(false, 'timeout');
    expect(service.startupStateSubject.value).toMatchObject({
      status: 'error',
      phase: 'authentication',
    });
    expect(router.navigateByUrl).not.toHaveBeenCalled();

    authentication.isAuthenticated.mockReturnValue(false);
    service.retryStartup();

    expect(authentication.attemptLoginUsingRefreshToken).toHaveBeenCalledTimes(2);
    expect(service.startupStateSubject.value.status).toBe('loading');
  });
});

describe('GlobalStateService project loading', () => {
  let service: GlobalStateService;
  let projectResponse: Subject<Project[]>;
  let queryProjects: ReturnType<typeof vi.fn>;
  let alerts: {error: ReturnType<typeof vi.fn>};
  let originalViewportHeight: string;

  beforeEach(() => {
    vi.useFakeTimers();
    originalViewportHeight = document.body.style.getPropertyValue('--vh');
    // Viewport events are unrelated to project loading. Avoid retaining the
    // service's bound window listeners after each independently created instance.
    vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
    projectResponse = new Subject<Project[]>();
    queryProjects = vi.fn(() => projectResponse);
    alerts = {error: vi.fn()};
    TestBed.configureTestingModule({
      providers: [
        GlobalStateService,
        {
          provide: UnitRoleService,
          useValue: {cache: new EntityCache<UnitRole>(), query: vi.fn(() => of([]))},
        },
        {provide: UnitService, useValue: {cache: new EntityCache<Unit>()}},
        {
          provide: UserService,
          useValue: {
            cache: {clear: vi.fn()},
            currentUser: {isStaff: false, hasRunFirstTimeSetup: true},
          },
        },
        {
          provide: AuthenticationService,
          useValue: {
            attemptLoginUsingRefreshToken: vi.fn((callback: (result: boolean) => void) =>
              callback(true),
            ),
          },
        },
        {
          provide: ProjectService,
          useValue: {cache: new EntityCache<Project>(), query: queryProjects},
        },
        {provide: CampusService, useValue: {query: vi.fn(() => of([]))}},
        {provide: TeachingPeriodService, useValue: {query: vi.fn(() => of([]))}},
        {provide: LearningOutcomeService, useValue: {query: vi.fn(() => of([]))}},
        {provide: FeedbackTemplateService, useValue: {query: vi.fn(() => of([]))}},
        {provide: Router, useValue: {navigateByUrl: vi.fn()}},
        {provide: AlertService, useValue: alerts},
        {provide: BreakpointObserver, useValue: {isMatched: vi.fn(() => false)}},
        {provide: AuthReturnUrlService, useValue: {rememberCurrentUrl: vi.fn()}},
      ],
    });
    service = TestBed.inject(GlobalStateService);
  });

  afterEach(() => {
    projectResponse.complete();
    TestBed.resetTestingModule();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalViewportHeight) {
      document.body.style.setProperty('--vh', originalViewportHeight);
    } else {
      document.body.style.removeProperty('--vh');
    }
  });

  it('opens the loading gate with a recoverable error when the project request fails', () => {
    const ready = vi.fn();
    service.onLoad(ready);
    service.loadGlobals();
    expect(queryProjects).toHaveBeenCalledWith(undefined, {
      params: {include_inactive: false, include_task_definitions: true},
    });
    expect(service.isLoadingSubject.value).toBe(true);
    expect(ready).not.toHaveBeenCalled();

    projectResponse.error(new Error('private upstream response'));

    expect(service.projectLoadErrorSubject.value).toBe(true);
    expect(service.isLoadingSubject.value).toBe(false);
    expect(ready).toHaveBeenCalledOnce();
    expect(alerts.error).toHaveBeenCalledExactlyOnceWith(
      'Unable to access the units you study.',
      6000,
    );
    vi.runOnlyPendingTimers();
    expect(ready).toHaveBeenCalledOnce();
  });

  it('opens the loading gate after a successful load without reporting an error', () => {
    const ready = vi.fn();
    service.onLoad(ready);
    service.loadGlobals();
    expect(service.isLoadingSubject.value).toBe(true);
    expect(ready).not.toHaveBeenCalled();

    projectResponse.next([]);
    projectResponse.complete();

    expect(service.isLoadingSubject.value).toBe(false);
    expect(service.projectLoadErrorSubject.value).toBe(false);
    expect(service.startupStateSubject.value.status).toBe('ready');
    expect(ready).toHaveBeenCalledOnce();
    expect(alerts.error).not.toHaveBeenCalled();
  });

  it('clears a previous project error when a subsequent load succeeds', () => {
    service.loadGlobals();
    projectResponse.error(new Error('offline'));
    expect(service.projectLoadErrorSubject.value).toBe(true);

    projectResponse = new Subject<Project[]>();
    queryProjects.mockReturnValue(projectResponse);
    service.loadGlobals();
    expect(service.projectLoadErrorSubject.value).toBe(false);
    expect(service.isLoadingSubject.value).toBe(true);
    projectResponse.next([]);
    projectResponse.complete();
    vi.advanceTimersByTime(800);

    expect(service.isLoadingSubject.value).toBe(false);
    expect(service.projectLoadErrorSubject.value).toBe(false);
    expect(queryProjects).toHaveBeenCalledTimes(2);
  });
});

function emptyCache(): object {
  return {
    clear: vi.fn(),
    values: new Subject().asObservable(),
    currentValues: [],
  };
}
