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

  it.todo('AC4: restores component.unitScope from the URL once URL-backed scope is implemented');
});
