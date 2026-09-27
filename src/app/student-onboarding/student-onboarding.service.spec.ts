import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {HttpClient} from '@angular/common/http';
import {NavigationEnd, Router} from '@angular/router';
import {BehaviorSubject, Subject, of, throwError} from 'rxjs';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {UserService} from 'src/app/api/services/user.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {StudentOnboardingService, parseOnboardingProgress} from './student-onboarding.service';

const key = 'ontrack:student-onboarding:1';
const record = (state: string, step = 'unit', version = 1) =>
  JSON.stringify({version, state, step});

describe('StudentOnboardingService', () => {
  let storage: Storage;
  let storageDescriptor: PropertyDescriptor | undefined;
  let service: StudentOnboardingService;
  let users: {currentUser: {id: number; role: string; hasRunFirstTimeSetup: boolean}};
  let auth: {isAuthenticated: ReturnType<typeof vi.fn>};
  let http: {get: ReturnType<typeof vi.fn>};
  let globals: {isLoadingSubject: BehaviorSubject<boolean>};
  let settings: {IsTutorialEnabled: BehaviorSubject<boolean>};
  let router: {url: string; events: Subject<NavigationEnd>; navigate: ReturnType<typeof vi.fn>};
  const route = (url = '/home') => {
    router.url = url;
    router.events.next(new NavigationEnd(1, url, url));
  };
  const finishProfile = () => {
    users.currentUser.hasRunFirstTimeSetup = true;
    globals.isLoadingSubject.next(false);
    route();
  };
  beforeEach(() => {
    const values: Map<string, string> = new Map();
    storage = {
      get length() {
        return values.size;
      },
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => values.clear(),
      key: (index) => [...values.keys()][index] ?? null,
    };
    storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {value: storage, configurable: true});
    users = {currentUser: {id: 1, role: 'Student', hasRunFirstTimeSetup: false}};
    auth = {isAuthenticated: vi.fn(() => true)};
    http = {get: vi.fn(() => of({hasProjects: false}))};
    globals = {isLoadingSubject: new BehaviorSubject(true)};
    settings = {IsTutorialEnabled: new BehaviorSubject(true)};
    router = {url: '/welcome', events: new Subject(), navigate: vi.fn()};
    service = new StudentOnboardingService(
      users as unknown as UserService,
      auth as unknown as AuthenticationService,
      globals as unknown as GlobalStateService,
      settings as unknown as DoubtfireConstants,
      router as unknown as Router,
      http as unknown as HttpClient,
      document,
    );
  });
  afterEach(() => {
    service.ngOnDestroy();
    vi.restoreAllMocks();
    if (storageDescriptor) {
      Object.defineProperty(window, 'localStorage', storageDescriptor);
    } else {
      delete window['localStorage'];
    }
  });

  it('requests only the authenticated current-user history boolean without owner parameters', () => {
    service.start();
    expect(http.get).toHaveBeenCalledOnce();
    expect(http.get).toHaveBeenCalledWith(expect.stringMatching(/\/projects\/history$/));
  });
  it.each([
    {history: {hasProjects: true}},
    {history: {}},
    {history: []},
    {history: null},
    {history: {hasProjects: 0}},
    {history: {hasProjects: 'false'}},
    {history: {hasProjects: false, userId: 1}},
    {history: {projects: []}},
  ])('keeps existing, malformed or unknown history replay-only: $history', ({history}) => {
    http.get.mockReturnValue(of(history));
    service.start();
    finishProfile();
    expect(service.view$.value).toBeNull();
    expect(storage.getItem(key)).toBeNull();
    service.replay();
    expect(service.view$.value?.replay).toBe(true);
  });
  it('does not replace invalid or future stored progress with a new automatic offer', () => {
    storage.setItem(key, record('completed', 'unit', 999));
    service.start();
    finishProfile();
    expect(http.get).not.toHaveBeenCalled();
    expect(service.view$.value).toBeNull();
    expect(storage.getItem(key)).toBe(record('completed', 'unit', 999));
  });
  it('fails open without retries when the history request fails', () => {
    http.get.mockReturnValue(throwError(() => new Error('network')));
    service.start();
    finishProfile();
    route();
    expect(service.view$.value).toBeNull();
    expect(http.get).toHaveBeenCalledOnce();
  });
  it('discards a delayed eligibility result after disable or account replacement', () => {
    const response: Subject<unknown> = new Subject();
    http.get.mockReturnValue(response);
    service.start();
    settings.IsTutorialEnabled.next(false);
    users.currentUser = {id: 2, role: 'Student', hasRunFirstTimeSetup: true};
    settings.IsTutorialEnabled.next(true);
    response.next({hasProjects: false});
    finishProfile();
    expect(service.view$.value).toBeNull();
    expect(storage.length).toBe(0);
  });
  it('does not persist eligibility when the pending account becomes staff', () => {
    const response: Subject<unknown> = new Subject();
    http.get.mockReturnValue(response);
    service.start();
    users.currentUser.role = 'Tutor';
    response.next({hasProjects: false});
    expect(storage.length).toBe(0);
    expect(service.view$.value).toBeNull();
  });
  it('times out history checks without retrying or interrupting normal use', () => {
    vi.useFakeTimers();
    try {
      http.get.mockReturnValue(new Subject());
      service.start();
      finishProfile();
      vi.advanceTimersByTime(10000);
      route();
      expect(service.view$.value).toBeNull();
      expect(http.get).toHaveBeenCalledOnce();
      service.replay();
      expect(service.view$.value?.replay).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it('returns automatic close to the last target and replay close to its visible launch control', () => {
    const target = document.createElement('button');
    target.dataset.onboardingTarget = 'unit-selector';
    const launch = document.createElement('button');
    launch.dataset.onboardingTarget = 'account-menu';
    for (const element of [target, launch]) {
      element.getBoundingClientRect = () => new DOMRect(10, 10, 80, 40);
      document.body.appendChild(element);
    }
    try {
      service.start();
      finishProfile();
      service.begin();
      service.close();
      expect(document.activeElement).toBe(target);
      launch.focus();
      service.replay();
      service.begin();
      service.next();
      service.close();
      expect(document.activeElement).toBe(launch);
    } finally {
      target.remove();
      launch.remove();
    }
  });
  it('can complete profile setup before the successful eligibility response without a race', () => {
    const response: Subject<unknown> = new Subject();
    http.get.mockReturnValue(response);
    service.start();
    finishProfile();
    expect(service.view$.value).toBeNull();
    response.next({hasProjects: false});
    expect(service.view$.value?.panel).toBe('welcome');
  });
  it('waits for profile, enrolment loading and a safe route before offering a new student the tutorial', () => {
    service.start();
    expect(service.view$.value).toBeNull();
    globals.isLoadingSubject.next(false);
    expect(service.view$.value).toBeNull();
    users.currentUser.hasRunFirstTimeSetup = true;
    globals.isLoadingSubject.next(false);
    expect(service.view$.value).toBeNull();
    route();
    expect(service.view$.value?.panel).toBe('welcome');
    expect(users.currentUser.hasRunFirstTimeSetup).toBe(true);
  });
  it('keeps returning students with absent progress replay-only', () => {
    users.currentUser.hasRunFirstTimeSetup = true;
    service.start();
    finishProfile();
    expect(service.view$.value).toBeNull();
    service.replay();
    expect(service.view$.value?.replay).toBe(true);
  });
  it.each(['Admin', 'Tutor', 'Convenor', 'Auditor'])(
    'excludes the %s role from automatic and manual starts',
    (role) => {
      users.currentUser.role = role;
      service.start();
      finishProfile();
      service.replay();
      expect(service.available).toBe(false);
      expect(service.view$.value).toBeNull();
      expect(storage.length).toBe(0);
    },
  );
  it('does not start or write progress while unauthenticated or disabled', () => {
    settings.IsTutorialEnabled.next(false);
    service.start();
    finishProfile();
    service.replay();
    expect(service.view$.value).toBeNull();
    auth.isAuthenticated.mockReturnValue(false);
    settings.IsTutorialEnabled.next(true);
    service.replay();
    expect(service.view$.value).toBeNull();
    expect(storage.length).toBe(0);
  });
  it('persists progress, supports Back and resumes the exact stable step after a reload', () => {
    service.start();
    finishProfile();
    service.begin();
    service.next();
    service.next();
    service.back();
    expect(JSON.parse(storage.getItem(key))).toEqual({
      version: 1,
      state: 'in-progress',
      step: 'tasks',
    });
    // Reconstruct the service as a fresh browser page; only persisted state crosses the boundary.
    service.ngOnDestroy();
    service = new StudentOnboardingService(
      users as unknown as UserService,
      auth as unknown as AuthenticationService,
      globals as unknown as GlobalStateService,
      settings as unknown as DoubtfireConstants,
      router as unknown as Router,
      http as unknown as HttpClient,
      document,
    );
    service.start();
    expect(service.view$.value).toMatchObject({panel: 'step', index: 1});
  });
  it('skips for this session without re-opening on route or loading events', () => {
    service.start();
    finishProfile();
    service.begin();
    service.skip();
    route('/projects/1/dashboard');
    globals.isLoadingSubject.next(false);
    expect(service.view$.value).toBeNull();
    expect(JSON.parse(storage.getItem(key)).state).toBe('skipped');
  });
  it('offers saved skipped progress in the next session', () => {
    storage.setItem(key, record('skipped', 'target-grade'));
    users.currentUser.hasRunFirstTimeSetup = true;
    service.start();
    finishProfile();
    expect(service.view$.value).toMatchObject({panel: 'welcome', index: 0});
  });
  it.each(['completed', 'dismissed'])(
    'never reopens %s automatically and replay preserves that choice through every transition',
    (state) => {
      storage.setItem(key, record(state));
      users.currentUser.hasRunFirstTimeSetup = true;
      service.start();
      finishProfile();
      expect(service.view$.value).toBeNull();
      service.replay();
      service.begin();
      service.next();
      service.requestSkip();
      service.cancelSkip();
      service.finish();
      expect(storage.getItem(key)).toBe(record(state));
    },
  );
  it('implements confirmation and Escape semantics without losing the current step', () => {
    service.start();
    finishProfile();
    service.begin();
    service.next();
    service.escape();
    expect(service.view$.value).toMatchObject({panel: 'skip', index: 1});
    service.escape();
    expect(service.view$.value).toMatchObject({panel: 'step', index: 1});
    service.close();
    expect(service.view$.value).toBeNull();
  });
  it('finishes the four steps and stores completion only when completion is acknowledged', () => {
    service.start();
    finishProfile();
    service.begin();
    for (let i = 0; i < 4; i++) {
      service.next();
    }
    expect(service.view$.value?.panel).toBe('complete');
    service.escape();
    expect(service.view$.value).toBeNull();
    expect(JSON.parse(storage.getItem(key)).state).toBe('completed');
  });
  it('dismisses automatic prompts permanently in this browser', () => {
    service.start();
    finishProfile();
    service.dismiss();
    route();
    expect(JSON.parse(storage.getItem(key)).state).toBe('dismissed');
    expect(service.view$.value).toBeNull();
  });
  it('fails open on blocked reads, allows manual replay and never loops', () => {
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    service.start();
    finishProfile();
    expect(service.view$.value).toBeNull();
    expect(service.storageUnavailable).toBe(true);
    service.replay();
    expect(service.view$.value?.panel).toBe('welcome');
    service.close();
    route();
    expect(service.view$.value).toBeNull();
  });
  it('keeps the shell usable and exposes a warning when writes fail', () => {
    service.start();
    finishProfile();
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    service.begin();
    service.next();
    expect(service.storageUnavailable).toBe(true);
    expect(service.view$.value).toMatchObject({panel: 'step', index: 1});
    service.close();
    route();
    expect(service.view$.value).toBeNull();
  });
  it('clears only memory on sign-out and isolates a different authenticated account', () => {
    service.start();
    finishProfile();
    service.begin();
    settings.IsTutorialEnabled.next(false);
    expect(service.view$.value).toBeNull();
    expect(storage.getItem(key)).toBeTruthy();
    users.currentUser = {id: 2, role: 'Student', hasRunFirstTimeSetup: true};
    settings.IsTutorialEnabled.next(true);
    expect(service.view$.value).toBeNull();
    service.replay();
    service.begin();
    service.finish();
    expect(storage.getItem('ontrack:student-onboarding:2')).toBeNull();
    expect(JSON.parse(storage.getItem(key)).state).toBe('in-progress');
  });
  it('never changes account data, navigates, or issues an assessment/calendar update', () => {
    const original = {...users.currentUser};
    service.start();
    finishProfile();
    const afterSetup = {...users.currentUser};
    service.begin();
    service.next();
    service.next();
    service.next();
    service.next();
    service.finish();
    expect(users.currentUser).toEqual(afterSetup);
    expect(afterSetup).toEqual({...original, hasRunFirstTimeSetup: true});
    expect(router.navigate).not.toHaveBeenCalled();
    expect(Object.keys(JSON.parse(storage.getItem(key))).sort()).toEqual([
      'state',
      'step',
      'version',
    ]);
  });
  it.each([
    '/edit_profile',
    '/welcome;mode=setup',
    '/projects/1/task_def_id/2/scorm-player/normal',
    '/projects/1/task_def_id/2/scorm-player/review/3',
    '/task_def_id/2/preview-scorm',
  ])('never covers the protected application route %s', (path) => {
    service.start();
    finishProfile();
    service.begin();
    route(path);
    service.replay();
    expect(service.available).toBe(false);
    expect(service.view$.value).toBeNull();
  });
  it('continues safely on browser Back and suppresses the tutorial on the profile route', () => {
    service.start();
    finishProfile();
    service.begin();
    service.next();
    route('/home');
    expect(service.view$.value?.index).toBe(1);
    route('/welcome');
    expect(service.view$.value).toBeNull();
    route();
    expect(service.view$.value).toBeNull();
  });
});

describe('untrusted onboarding progress', () => {
  it.each([
    null,
    '',
    '{',
    'null',
    '[]',
    record('unknown'),
    record('completed', 'injected'),
    record('completed', 'unit', 999),
    record('completed', 'unit', 0),
    JSON.stringify({version: 1, state: 'completed', step: 'unit', userId: 4}),
    ' '.repeat(257),
  ])('rejects invalid or future input %s', (raw) => {
    expect(parseOnboardingProgress(raw)).toBeNull();
  });
  it('accepts only the minimum valid progress fields', () => {
    expect(parseOnboardingProgress(record('in-progress', 'calendar'))).toEqual({
      version: 1,
      state: 'in-progress',
      step: 'calendar',
    });
  });
});
