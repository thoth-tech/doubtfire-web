import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {HttpClient} from '@angular/common/http';
import {Type} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Data,
  Route,
  Router,
  RouterStateSnapshot,
  Routes,
  UrlTree,
  convertToParamMap,
} from '@angular/router';
import {BehaviorSubject, Observable} from 'rxjs';
import {InstitutionSettingsComponent} from 'src/app/admin/institution-settings/institution-settings.component';
import {FUnitsComponent} from 'src/app/admin/states/units/units.component';
import {FUsersComponent} from 'src/app/admin/states/users/users.component';
import {AuthenticationService, UserService} from 'src/app/api/models/doubtfire-model';
import {routes} from 'src/app/app.routes';
import {AlertService} from 'src/app/common/services/alert.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {JplagReportViewerComponent} from 'src/app/projects/states/jplag/jplag-report-viewer.component';
import {TutorDiscussionComponent} from 'src/app/projects/states/tutor-discussion/tutor-discussion.component';
import {UnitAnalyticsComponent} from 'src/app/units/states/analytics/unit-analytics-route.component';
import {UnitAdminStateComponent} from 'src/app/units/states/edit/unit-admin-state.component';
import {UnitGroupsComponent} from 'src/app/units/states/groups/unit-groups/unit-groups.component';
import {PortfoliosComponent} from 'src/app/units/states/portfolios/portfolios.component';
import {RolloverComponent} from 'src/app/units/states/rollover/rollover.component';
import {StudentsListComponent} from 'src/app/units/states/students-list/students-list.component';
import {UnitTaskInboxStateComponent} from 'src/app/units/states/tasks/inbox/unit-task-inbox-state.component';
import {TaskViewerStateComponent} from 'src/app/units/task-viewer/task-viewer-state.component';
import {roleWhitelistGuard} from '../role-whitelist.guard';

/**
 * Components that only teaching staff should ever reach. Every route that renders one of
 * these has to carry roleWhitelistGuard, on itself or on a parent, unless its full path is
 * listed in DELIBERATELY_OPEN_PATHS below.
 *
 * Add to this list when you add a staff screen. That is the whole point of it.
 */
const STAFF_ONLY_COMPONENTS: Type<unknown>[] = [
  FUnitsComponent,
  FUsersComponent,
  InstitutionSettingsComponent,
  JplagReportViewerComponent,
  PortfoliosComponent,
  RolloverComponent,
  StudentsListComponent,
  TaskViewerStateComponent,
  TutorDiscussionComponent,
  UnitAdminStateComponent,
  UnitAnalyticsComponent,
  UnitGroupsComponent,
  UnitTaskInboxStateComponent,
];

/**
 * Routes onto a staff component that are open on purpose. Anything added here needs a
 * comment on the route itself saying why it is open.
 */
const DELIBERATELY_OPEN_PATHS: string[] = [
  // FUnitsComponent in 'student' mode lists the signed in user's own enrolled units.
  'view-all-projects',
  // An empty iframe onto the bundled JPlag viewer. It makes no api call and holds no data of
  // its own until staff hand it a blob url from their own tab.
  'jplag-report-viewer',
];

interface FlatRoute {
  path: string;
  component?: Type<unknown>;
  guarded: boolean;
  roleWhitelist?: string[];
  ownGuard: boolean;
  ownWhitelist?: string[];
}

function hasRoleGuard(route: Route): boolean {
  return (route.canActivate ?? []).includes(roleWhitelistGuard);
}

function flatten(
  children: Routes,
  parentPath: string,
  inheritedGuard: boolean,
  inheritedWhitelist: string[] | undefined,
): FlatRoute[] {
  return children.flatMap((route) => {
    const path = [parentPath, route.path].filter((part) => !!part).join('/');
    const ownGuard = hasRoleGuard(route);
    const ownWhitelist = route.data?.['roleWhitelist'] as string[] | undefined;
    const guarded = inheritedGuard || ownGuard;
    const roleWhitelist = ownGuard ? ownWhitelist : inheritedWhitelist;

    const self: FlatRoute = {
      path,
      component: route.component,
      guarded,
      roleWhitelist,
      ownGuard,
      ownWhitelist,
    };
    const descendants = route.children ? flatten(route.children, path, guarded, roleWhitelist) : [];

    return [self, ...descendants];
  });
}

const flatRoutes = flatten(routes, '', false, undefined);
const staffRoutes = flatRoutes.filter(
  (route) => route.component && STAFF_ONLY_COMPONENTS.includes(route.component),
);

describe('app route role guard coverage', () => {
  it('finds the staff routes it is meant to be checking', () => {
    // Guards the walk itself. If flatten() ever stops descending, this fails rather than
    // letting the assertions below pass over an empty list.
    expect(staffRoutes.length).toBeGreaterThanOrEqual(25);
    expect(staffRoutes.map((route) => route.path)).toContain(
      'units/:unitId/tasks/:taskAbbreviation',
    );
  });

  it('puts roleWhitelistGuard on every route that renders a staff only component', () => {
    const unguarded = staffRoutes
      .filter((route) => !route.guarded)
      .map((route) => route.path)
      .filter((path) => !DELIBERATELY_OPEN_PATHS.includes(path));

    expect(
      unguarded,
      `these staff routes have no roleWhitelistGuard: ${unguarded.join(', ')}. Add ` +
        'canActivate: [roleWhitelistGuard] and a roleWhitelist, or list the path in ' +
        'DELIBERATELY_OPEN_PATHS with a comment on the route saying why it is open.',
    ).toEqual([]);
  });

  it('gives every guarded staff route a non empty whitelist', () => {
    const missing = staffRoutes
      .filter((route) => route.guarded && !route.roleWhitelist?.length)
      .map((route) => route.path);

    expect(missing, `these guarded routes have no roleWhitelist: ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  it('never puts the guard on a route without a whitelist of its own', () => {
    // roleWhitelistGuard falls through to true when data.roleWhitelist is missing, so this
    // pairing looks protected and is not.
    const emptyGuards = flatRoutes
      .filter((route) => route.ownGuard && !route.ownWhitelist?.length)
      .map((route) => route.path);

    expect(
      emptyGuards,
      `these routes ask for the guard and give it nothing to check: ${emptyGuards.join(', ')}`,
    ).toEqual([]);
  });

  it('leaves the student routes alone', () => {
    // The negative case. If a change starts guarding everything, this goes red.
    const studentPaths = [
      'home',
      'sign_in',
      'projects/:projectId/dashboard',
      'projects/:projectId/portfolio',
      'view-all-projects',
    ];

    const wronglyGuarded = flatRoutes
      .filter((route) => studentPaths.includes(route.path) && route.guarded)
      .map((route) => route.path);

    expect(wronglyGuarded).toEqual([]);
  });

  it('only ever whitelists role names the api actually issues', () => {
    const validRoles = ['Student', 'Tutor', 'Convenor', 'Admin', 'Auditor'];
    const invalid = flatRoutes
      .flatMap((route) => route.ownWhitelist ?? [])
      .filter((role) => !validRoles.includes(role));

    expect(invalid).toEqual([]);
  });
});

const UNIT_ID = 12;

/**
 * Which roles the guard has to admit and refuse, per route, run through the guard itself.
 *
 * The block above only proves a guard is attached. It says nothing about who that guard lets
 * in, so a whitelist that locks out a whole role passes it. These do execute the guard, against
 * the whitelist that is really in app.routes.ts, so a wrong whitelist goes red here.
 *
 * Paths under 'units/:unitId' resolve the caller's UNIT role. Top level paths resolve the
 * SYSTEM role. Same guard, different question, which is why two identical looking whitelists
 * on the two kinds of path do not admit the same people.
 */
const UNIT_ROLE_EXPECTATIONS: {path: string; allow: string[]; refuse: string[]}[] = [
  // The staff menu offers Discussion and Check-in to every unit role, and the header QR button
  // routes every non student to 'discussion'. Convenors have to be able to get there.
  {path: 'units/:unitId/discussion', allow: ['Convenor', 'Tutor'], refuse: ['Student']},
  {path: 'units/:unitId/check-in', allow: ['Convenor', 'Tutor'], refuse: ['Student']},
  {path: 'units/:unitId/analytics', allow: ['Convenor', 'Tutor'], refuse: ['Student']},
  {path: 'units/:unitId/students', allow: ['Convenor', 'Tutor'], refuse: ['Student']},
  {path: 'units/:unitId/students/groups', allow: ['Convenor', 'Tutor'], refuse: ['Student']},
  {path: 'units/:unitId/students/portfolios', allow: ['Convenor', 'Tutor'], refuse: ['Student']},
  {path: 'units/:unitId/tasks/inbox', allow: ['Convenor', 'Tutor'], refuse: ['Student']},
  {path: 'units/:unitId/tasks/moderation', allow: ['Convenor', 'Tutor'], refuse: ['Student']},
  // Convenor and above. Unit administration, rollover and the whole unit task list are not a
  // tutor's queue. A tutor deep link belongs on 'tasks/inbox/:studentId/:taskDefAbbr' above.
  {path: 'units/:unitId/admin', allow: ['Convenor'], refuse: ['Tutor', 'Student']},
  {path: 'units/:unitId/rollover', allow: ['Convenor'], refuse: ['Tutor', 'Student']},
  {path: 'units/:unitId/tasks', allow: ['Convenor'], refuse: ['Tutor', 'Student']},
  {
    path: 'units/:unitId/tasks/:taskAbbreviation',
    allow: ['Convenor'],
    refuse: ['Tutor', 'Student'],
  },
];

const SYSTEM_ROLE_EXPECTATIONS: {path: string; allow: string[]; refuse: string[]}[] = [
  {path: 'view-all-units', allow: ['Tutor', 'Convenor', 'Admin', 'Auditor'], refuse: ['Student']},
  {
    path: 'tutor-attendance',
    allow: ['Tutor', 'Convenor', 'Admin', 'Auditor'],
    refuse: ['Student'],
  },
  // 'tutor-discussion' refuses Convenor on 11.0.x already. This change does not widen it, and
  // pinning it here is what makes that a decision rather than an oversight.
  {path: 'tutor-discussion', allow: ['Tutor', 'Admin', 'Auditor'], refuse: ['Convenor', 'Student']},
  {path: 'admin/units', allow: ['Convenor', 'Admin', 'Auditor'], refuse: ['Tutor', 'Student']},
  {path: 'admin/users', allow: ['Admin', 'Auditor'], refuse: ['Convenor', 'Tutor', 'Student']},
  {
    path: 'admin/institution-settings',
    allow: ['Admin', 'Auditor'],
    refuse: ['Convenor', 'Tutor', 'Student'],
  },
];

/**
 * The whitelist the guard will really see on this path, taken from app.routes.ts rather than
 * repeated here. Where two routes share a path the first one wins, which is what the router
 * does too.
 */
function whitelistFor(path: string): string[] {
  const match = flatRoutes.find((route) => route.path === path);
  expect(match, `no route in app.routes.ts has the path '${path}'`).toBeDefined();
  expect(
    match?.roleWhitelist,
    `route '${path}' reaches the guard with no roleWhitelist`,
  ).toBeDefined();

  return match.roleWhitelist;
}

describe('roleWhitelistGuard role decisions', () => {
  const globalState = {
    isLoadingSubject: new BehaviorSubject<boolean>(false),
    loadedUnitRoles: {currentValues: [] as {unit: {id: number}; role: string}[]},
  };
  const userService = {currentUser: {role: 'Student'}};
  const router = {
    createUrlTree: (commands: unknown[]) => ({commands}) as unknown as UrlTree,
  };

  beforeEach(() => {
    globalState.isLoadingSubject.next(false);
    globalState.loadedUnitRoles.currentValues = [];
    userService.currentUser.role = 'Student';

    TestBed.configureTestingModule({
      providers: [
        AuthenticationService,
        {provide: AlertService, useValue: {}},
        {provide: DoubtfireConstants, useValue: {API_URL: ''}},
        {provide: GlobalStateService, useValue: globalState},
        {provide: HttpClient, useValue: {}},
        {provide: Router, useValue: router},
        {provide: UserService, useValue: userService},
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function snapshotFor(data: Data, unitId?: number): ActivatedRouteSnapshot {
    return {
      data,
      paramMap: convertToParamMap(unitId === undefined ? {} : {unitId: String(unitId)}),
      parent: null,
      pathFromRoot: [],
    } as unknown as ActivatedRouteSnapshot;
  }

  function activate(snapshot: ActivatedRouteSnapshot): boolean | UrlTree {
    const result = TestBed.runInInjectionContext(
      () =>
        roleWhitelistGuard(snapshot, {} as RouterStateSnapshot) as Observable<boolean | UrlTree>,
    );

    let outcome: boolean | UrlTree | undefined;
    result.subscribe((value) => (outcome = value));
    expect(outcome, 'the guard did not settle synchronously').toBeDefined();

    return outcome;
  }

  function admitsUnitRole(path: string, unitRole: string): boolean {
    // The system role is left as Student on purpose. If role resolution ever stopped reading the
    // unit role it would fall back to this and every allow case below would fail.
    userService.currentUser.role = 'Student';
    globalState.loadedUnitRoles.currentValues =
      unitRole === 'Student' ? [] : [{unit: {id: UNIT_ID}, role: unitRole}];

    return activate(snapshotFor({roleWhitelist: whitelistFor(path)}, UNIT_ID)) === true;
  }

  function admitsSystemRole(path: string, systemRole: string): boolean {
    globalState.loadedUnitRoles.currentValues = [];
    userService.currentUser.role = systemRole;

    return activate(snapshotFor({roleWhitelist: whitelistFor(path)})) === true;
  }

  for (const expectation of UNIT_ROLE_EXPECTATIONS) {
    it(`admits ${expectation.allow.join(' and ')} to ${expectation.path}`, () => {
      for (const role of expectation.allow) {
        expect(admitsUnitRole(expectation.path, role), `${role} was refused`).toBe(true);
      }
    });

    it(`refuses ${expectation.refuse.join(' and ')} on ${expectation.path}`, () => {
      for (const role of expectation.refuse) {
        expect(admitsUnitRole(expectation.path, role), `${role} was admitted`).toBe(false);
      }
    });
  }

  it('sends a refused caller to /unauthorised rather than just returning false', () => {
    userService.currentUser.role = 'Student';
    globalState.loadedUnitRoles.currentValues = [];

    const outcome = activate(
      snapshotFor({roleWhitelist: whitelistFor('units/:unitId/admin')}, UNIT_ID),
    );

    expect(outcome).toEqual({commands: ['/unauthorised']});
  });

  it('lets a system Admin or Auditor into a unit they hold no unit role in', () => {
    // roleForRoute falls back to the system role for these two. Every unit whitelist has to keep
    // carrying them or site administration loses access to the units it administers.
    for (const path of UNIT_ROLE_EXPECTATIONS.map((expectation) => expectation.path)) {
      for (const role of ['Admin', 'Auditor']) {
        globalState.loadedUnitRoles.currentValues = [];
        userService.currentUser.role = role;

        expect(
          activate(snapshotFor({roleWhitelist: whitelistFor(path)}, UNIT_ID)),
          `${role} was refused on ${path}`,
        ).toBe(true);
      }
    }
  });

  it('still admits a system Convenor to a unit they hold no unit role in', () => {
    // Pinning a gap, not endorsing it. roleForRoute returns undefined here, but isAuthorised
    // falls back to the system role when it is handed one, so the undefined never refuses
    // anybody. A system Convenor with no role in unit 12 reaches /units/12/admin. The card for
    // this change says not to touch the guard's logic, so this records today's behaviour and
    // will go red when someone fixes it on its own ticket.
    globalState.loadedUnitRoles.currentValues = [];
    userService.currentUser.role = 'Convenor';

    expect(
      activate(snapshotFor({roleWhitelist: whitelistFor('units/:unitId/admin')}, UNIT_ID)),
    ).toBe(true);
  });

  for (const expectation of SYSTEM_ROLE_EXPECTATIONS) {
    it(`admits ${expectation.allow.join(' and ')} to ${expectation.path}`, () => {
      for (const role of expectation.allow) {
        expect(admitsSystemRole(expectation.path, role), `${role} was refused`).toBe(true);
      }
    });

    it(`refuses ${expectation.refuse.join(' and ')} on ${expectation.path}`, () => {
      for (const role of expectation.refuse) {
        expect(admitsSystemRole(expectation.path, role), `${role} was admitted`).toBe(false);
      }
    });
  }

  it('waits for the global state to finish loading before it decides', () => {
    globalState.isLoadingSubject.next(true);
    userService.currentUser.role = 'Student';

    const result = TestBed.runInInjectionContext(
      () =>
        roleWhitelistGuard(
          snapshotFor({roleWhitelist: whitelistFor('units/:unitId/admin')}, UNIT_ID),
          {} as RouterStateSnapshot,
        ) as Observable<boolean | UrlTree>,
    );

    let outcome: boolean | UrlTree | undefined;
    result.subscribe((value) => (outcome = value));
    expect(outcome, 'the guard decided while the roles were still loading').toBeUndefined();

    globalState.loadedUnitRoles.currentValues = [{unit: {id: UNIT_ID}, role: 'Convenor'}];
    globalState.isLoadingSubject.next(false);

    expect(outcome).toBe(true);
  });

  describe('a guarded route with no whitelist', () => {
    const noWhitelist = () =>
      ({
        data: {},
        paramMap: convertToParamMap({}),
        parent: null,
        pathFromRoot: [
          {routeConfig: {path: 'units'}},
          {routeConfig: {path: ':unitId'}},
          {routeConfig: {path: 'analytics'}},
        ],
      }) as unknown as ActivatedRouteSnapshot;

    it('still lets the caller through, so a missing whitelist cannot lock production out', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      userService.currentUser.role = 'Student';

      expect(activate(noWhitelist())).toBe(true);

      spy.mockRestore();
    });

    it('logs an error naming the route so the mistake is visible while developing', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      activate(noWhitelist());

      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0][0]).toContain('units/:unitId/analytics');

      spy.mockRestore();
    });
  });
});
