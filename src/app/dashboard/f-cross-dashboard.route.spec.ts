import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {Router, provideRouter} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {BehaviorSubject, EMPTY, of} from 'rxjs';
import {AuthenticationService} from '../api/services/authentication.service';
import {ProjectService} from '../api/services/project.service';
import {TaskRecommendationService} from '../api/services/task-recommendation.service';
import {TaskService} from '../api/services/task.service';
import {UserService} from '../api/services/user.service';
import {routes} from '../app.routes';
import {GlobalStateService} from '../projects/states/index/global-state.service';
import {CrossDashboardComponent} from './f-cross-dashboard.component';

describe('Cross-Project Dashboard route (/dashboard)', () => {
  const userServiceMock = {
    currentUser: {role: 'Student'},
  };

  const isAuthorisedMock = vi.fn((roleWhitelist: string[], role?: string) => {
    return role !== undefined && roleWhitelist.includes(role);
  });

  const globalStateMock = {
    isLoadingSubject: new BehaviorSubject<boolean>(false),
    loadedUnitRoles: {currentValues: []},
    currentUserProjects: {values: of([])},
    onLoad: (run: () => void) => run(),
  };

  const projectServiceMock = {
    query: vi.fn().mockReturnValue(of([])),
  };

  beforeEach(() => {
    userServiceMock.currentUser.role = 'Student';
    isAuthorisedMock.mockClear();
    projectServiceMock.query.mockClear();

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: AuthenticationService,
          useValue: {isAuthorised: isAuthorisedMock},
        },
        {
          provide: UserService,
          useValue: userServiceMock,
        },
        {
          provide: GlobalStateService,
          useValue: globalStateMock,
        },
        {
          provide: ProjectService,
          useValue: projectServiceMock,
        },
        {
          provide: TaskRecommendationService,
          useValue: {getAll: () => of([])},
        },
        {
          provide: TaskService,
          useValue: {taskStatusUpdated$: EMPTY},
        },
      ],
    });
  });

  it('AC1: allows a Student to navigate directly to /dashboard', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');
    const router = TestBed.inject(Router);

    expect(router.url).toBe('/dashboard');
    expect(harness.routeNativeElement).toBeTruthy();
    expect(isAuthorisedMock).toHaveBeenCalledTimes(1);
    expect(isAuthorisedMock).toHaveBeenCalledWith(['Student'], 'Student');
  });

  it('AC3: redirects a non-whitelisted Tutor to /unauthorised', async () => {
    userServiceMock.currentUser.role = 'Tutor';

    const harness = await RouterTestingHarness.create('/dashboard');
    const router = TestBed.inject(Router);

    expect(router.url).toBe('/unauthorised');
    expect(harness.routeNativeElement).toBeTruthy();
    expect(isAuthorisedMock).toHaveBeenCalledTimes(1);
    expect(isAuthorisedMock).toHaveBeenCalledWith(['Student'], 'Tutor');
  });

  // RouterTestingHarness performs client-side navigation. It does not restart
  // the browser or Angular application, so real refresh coverage belongs in
  // a future browser-level end-to-end test.

  it.each(['previous', 'all'] as const)(
    'AC4: restores %s unit scope on direct navigation',
    async (scope) => {
      const harness = await RouterTestingHarness.create();
      const component = await harness.navigateByUrl(
        `/dashboard?scope=${scope}`,
        CrossDashboardComponent,
      );
      expect(component.unitScope).toBe(scope);
      expect(projectServiceMock.query).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['/dashboard', '/dashboard?scope=invalid', '/dashboard?scope=active'])(
    'defaults to active for %s without loading previous units',
    async (url) => {
      const harness = await RouterTestingHarness.create();
      const component = await harness.navigateByUrl(url, CrossDashboardComponent);
      expect(component.unitScope).toBe('active');
      expect(projectServiceMock.query).not.toHaveBeenCalled();
    },
  );

  it('follows query-only navigation on a reused dashboard without reloading previous units', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(
      '/dashboard?scope=previous',
      CrossDashboardComponent,
    );
    const next = await harness.navigateByUrl('/dashboard?scope=all', CrossDashboardComponent);
    expect(next).toBe(component);
    expect(component.unitScope).toBe('all');
    await harness.navigateByUrl('/dashboard', CrossDashboardComponent);
    expect(component.unitScope).toBe('active');
    expect(projectServiceMock.query).toHaveBeenCalledTimes(1);
  });

  it('keeps the open phone card when unrelated query parameters change', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/dashboard?scope=all', CrossDashboardComponent);
    component.expandedMobileProjectId = 42;
    await harness.navigateByUrl('/dashboard?scope=all&tab=tasks', CrossDashboardComponent);
    expect(component.expandedMobileProjectId).toBe(42);
    expect(projectServiceMock.query).toHaveBeenCalledTimes(1);
  });

  it('writes scope changes while preserving unrelated query parameters and the fragment', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(
      '/dashboard?tab=tasks#units',
      CrossDashboardComponent,
    );
    const router = TestBed.inject(Router);
    component.setUnitScope('previous');
    await harness.fixture.whenStable();
    expect(router.url).toBe('/dashboard?tab=tasks&scope=previous#units');
    component.clearGlobalFilters();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/dashboard?tab=tasks#units');
    expect(component.unitScope).toBe('active');
  });
});
