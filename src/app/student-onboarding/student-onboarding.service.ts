import {DOCUMENT} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {Inject, Injectable, OnDestroy} from '@angular/core';
import {NavigationEnd, Router} from '@angular/router';
import {BehaviorSubject, Subscription, filter, merge, timeout} from 'rxjs';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {UserService} from 'src/app/api/services/user.service';
import API_URL from 'src/app/config/constants/apiUrl';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {resolveOnboardingTarget} from './student-onboarding-target';
import {ONBOARDING_STEPS, ONBOARDING_VERSION, OnboardingStepId} from './student-onboarding.steps';

export type ProgressState = 'new' | 'in-progress' | 'skipped' | 'dismissed' | 'completed';
export interface OnboardingProgress {
  version: number;
  state: ProgressState;
  step: OnboardingStepId;
}
export type OnboardingPanel = 'welcome' | 'step' | 'skip' | 'complete';
export interface OnboardingView {
  panel: OnboardingPanel;
  index: number;
  replay: boolean;
}
const STATES: readonly string[] = ['new', 'in-progress', 'skipped', 'dismissed', 'completed'];

/** Browser progress is untrusted; reject extra fields and unknown/future schemas. */
export function parseOnboardingProgress(raw: string | null): OnboardingProgress | null {
  if (!raw || raw.length > 256) {
    return null;
  }
  try {
    const value = JSON.parse(raw);
    if (
      !value ||
      Object.keys(value).sort().join(',') !== 'state,step,version' ||
      !Number.isInteger(value.version) ||
      value.version < 1 ||
      value.version > ONBOARDING_VERSION ||
      !STATES.includes(value.state) ||
      !ONBOARDING_STEPS.some((step) => step.id === value.step)
    ) {
      return null;
    }
    return {version: value.version, state: value.state, step: value.step};
  } catch {
    return null;
  }
}

@Injectable({providedIn: 'root'})
export class StudentOnboardingService implements OnDestroy {
  readonly view$: BehaviorSubject<OnboardingView | null> = new BehaviorSubject(null);
  storageUnavailable = false;
  private subscription?: Subscription;
  private accountId?: number;
  private historySubscription?: Subscription;
  private historyChecked = false;
  private invalidProgress = false;
  private generation = 0;
  private progress: OnboardingProgress | null = null;
  private offered = false;
  private skipReturn: OnboardingPanel = 'welcome';
  private returnFocus?: HTMLElement;

  constructor(
    private users: UserService,
    private auth: AuthenticationService,
    private globals: GlobalStateService,
    private settings: DoubtfireConstants,
    private router: Router,
    private http: HttpClient,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  start(): void {
    if (this.subscription) {
      return;
    }
    this.subscription = merge(
      this.globals.isLoadingSubject,
      this.settings.IsTutorialEnabled,
      this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    ).subscribe(() => this.evaluate());
  }

  get available(): boolean {
    const user = this.users.currentUser;
    const path = this.router.url.split(/[?#]/)[0];
    const protectedRoute =
      /^\/(welcome|edit_profile|sign_in|sign_out)([;/]|$)|\/(scorm-player|preview-scorm)([;/]|$)/.test(
        path,
      );
    return (
      this.settings.IsTutorialEnabled.value &&
      this.auth.isAuthenticated() &&
      Number.isSafeInteger(user?.id) &&
      user.id > 0 &&
      user.role === 'Student' &&
      user.hasRunFirstTimeSetup === true &&
      !this.globals.isLoadingSubject.value &&
      !protectedRoute
    );
  }

  private evaluate(): void {
    const user = this.users.currentUser;
    // Reset at sign-out/settings failure even before the asynchronous auth teardown finishes.
    if (
      !this.settings.IsTutorialEnabled.value ||
      !this.auth.isAuthenticated() ||
      user?.role !== 'Student'
    ) {
      this.reset();
      return;
    }
    if (!Number.isSafeInteger(user.id) || user.id < 1) {
      this.reset();
      return;
    }
    if (this.accountId !== user.id) {
      this.reset();
      this.accountId = user.id;
      try {
        const raw = this.document.defaultView.localStorage.getItem(this.key);
        this.progress = parseOnboardingProgress(raw);
        this.invalidProgress = raw !== null && !this.progress;
      } catch {
        this.storageUnavailable = true;
      }
    }
    // Observe the existing setup boundary; never change the user or profile flag.
    // An existing account with no progress is replay-only, not assumed new.
    if (
      user.hasRunFirstTimeSetup === false &&
      !this.progress &&
      !this.storageUnavailable &&
      !this.invalidProgress &&
      !this.historyChecked
    ) {
      this.historyChecked = true;
      const accountId = this.accountId;
      const generation = this.generation;
      // This endpoint derives its owner from authentication; no user id is supplied.
      // The bounded boolean includes withdrawn/inactive history without returning
      // project, assessment or identity data. An older API fails safely to replay.
      this.historySubscription = this.http
        .get<unknown>(`${API_URL}/projects/history`)
        .pipe(timeout(10000))
        .subscribe({
          next: (history) => {
            if (
              generation !== this.generation ||
              accountId !== this.users.currentUser?.id ||
              this.users.currentUser.role !== 'Student' ||
              !this.settings.IsTutorialEnabled.value ||
              !this.auth.isAuthenticated()
            ) {
              return;
            }
            if (
              history !== null &&
              typeof history === 'object' &&
              Object.keys(history).join(',') === 'hasProjects' &&
              (history as {hasProjects: unknown}).hasProjects === false
            ) {
              this.save('new', 0);
              this.evaluate();
            }
          },
          error: () => {
            /* Unknown history stays replay-only; never block profile setup. */
          },
        });
    }
    if (!this.available) {
      this.view$.next(null);
      return;
    }
    if (
      this.offered ||
      this.storageUnavailable ||
      !this.progress ||
      ['completed', 'dismissed'].includes(this.progress.state)
    ) {
      return;
    }
    this.offered = true;
    const resume =
      this.progress.state === 'in-progress' && this.progress.version === ONBOARDING_VERSION;
    this.returnFocus = this.document.activeElement as HTMLElement;
    this.view$.next({
      panel: resume ? 'step' : 'welcome',
      index: resume ? this.savedIndex : 0,
      replay: false,
    });
  }

  replay(): void {
    this.evaluate();
    if (!this.available) {
      return;
    }
    this.offered = true;
    this.returnFocus = this.document.activeElement as HTMLElement;
    this.view$.next({panel: 'welcome', index: 0, replay: true});
  }

  begin(): void {
    this.transition('step', 0);
  }

  next(): void {
    const view = this.view$.value;
    if (view?.panel !== 'step') {
      return;
    }
    this.transition(
      view.index === ONBOARDING_STEPS.length - 1 ? 'complete' : 'step',
      Math.min(view.index + 1, ONBOARDING_STEPS.length - 1),
    );
  }

  back(): void {
    const view = this.view$.value;
    if (view?.panel === 'step') {
      this.transition('step', Math.max(0, view.index - 1));
    }
  }

  requestSkip(): void {
    const view = this.view$.value;
    if (view && view.panel !== 'skip') {
      this.skipReturn = view.panel;
      this.view$.next({...view, panel: 'skip'});
    }
  }

  cancelSkip(): void {
    const view = this.view$.value;
    if (view?.panel === 'skip') {
      this.view$.next({...view, panel: this.skipReturn});
    }
  }

  escape(): void {
    switch (this.view$.value?.panel) {
      case 'step':
        this.requestSkip();
        break;
      case 'skip':
        this.cancelSkip();
        break;
      case 'complete':
        this.finish();
        break;
      case 'welcome':
        this.skip();
        break;
    }
  }

  skip(): void {
    this.end('skipped');
  }
  dismiss(): void {
    this.end('dismissed');
  }
  finish(): void {
    this.end('completed');
  }
  close(): void {
    this.end(this.view$.value?.panel === 'complete' ? 'completed' : 'skipped');
  }

  private transition(panel: OnboardingPanel, index: number): void {
    const view = this.view$.value;
    if (!view) {
      return;
    }
    if (!view.replay) {
      this.save('in-progress', index);
    }
    this.view$.next({...view, panel, index});
  }

  private end(state: ProgressState): void {
    const view = this.view$.value;
    if (!view) {
      return;
    }
    if (!view.replay) {
      this.save(state, view.index);
    }
    this.view$.next(null);
    const lastTarget = !view.replay
      ? resolveOnboardingTarget(this.document, ONBOARDING_STEPS[view.index].target)
      : null;
    const launch = this.returnFocus;
    const visibleLaunch =
      launch &&
      launch !== this.document.body &&
      launch.isConnected &&
      launch.getBoundingClientRect().width > 0
        ? launch
        : null;
    const target =
      lastTarget ??
      visibleLaunch ??
      resolveOnboardingTarget(this.document, 'account-menu') ??
      this.document.querySelector<HTMLElement>('main, [role="main"]');
    if (target) {
      const addedTabIndex =
        !target.hasAttribute('tabindex') &&
        !target.matches('button, a[href], input, select, textarea');
      if (addedTabIndex) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus();
      if (addedTabIndex) {
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), {once: true});
      }
    }
  }

  private get savedIndex(): number {
    return Math.max(
      0,
      ONBOARDING_STEPS.findIndex((step) => step.id === this.progress?.step),
    );
  }
  private get key(): string {
    return `ontrack:student-onboarding:${this.accountId}`;
  }

  private save(state: ProgressState, index: number): void {
    // Never accept a caller-supplied account id or write after the session changes.
    if (
      !this.accountId ||
      this.users.currentUser?.id !== this.accountId ||
      !this.auth.isAuthenticated()
    ) {
      return;
    }
    this.progress = {version: ONBOARDING_VERSION, state, step: ONBOARDING_STEPS[index].id};
    try {
      this.document.defaultView.localStorage.setItem(this.key, JSON.stringify(this.progress));
    } catch {
      this.storageUnavailable = true;
    }
  }

  private reset(): void {
    this.generation++;
    this.historySubscription?.unsubscribe();
    this.historySubscription = undefined;
    this.historyChecked = false;
    this.invalidProgress = false;
    this.view$.next(null);
    this.accountId = undefined;
    this.progress = null;
    this.offered = false;
    this.storageUnavailable = false;
    this.returnFocus = undefined;
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.reset();
    this.view$.complete();
  }
}
