import {EntityCache} from 'ngx-entity-service';
import {BreakpointObserver} from '@angular/cdk/layout';
import {Injectable, OnDestroy} from '@angular/core';
import {Router} from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  Subject,
  Subscription,
  TimeoutError,
  catchError,
  forkJoin,
  of,
  switchMap,
  tap,
  throwError,
  timeout,
} from 'rxjs';
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
import {
  AuthenticationService,
  RefreshTokenFailureReason,
} from 'src/app/api/services/authentication.service';
import {FeedbackTemplateService} from 'src/app/api/services/feedback-template.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {AuthReturnUrlService} from 'src/app/security/auth-return-url.service';

/**
 * The different types of views that can be shown. Used by the header to determine details to show.
 */
export enum ViewType {
  UNIT = 'UNIT',
  PROJECT = 'PROJECT',
  OTHER = 'OTHER',
}

/**
 * The current view and entity being shown in the application - maintained currentViewAndEntitySubject$
 * of the global state. This connects with the header to ensure the correct details are shown.
 */
export class DoubtfireViewState {
  public entity: Project | Unit | UnitRole;
  public viewType: ViewType;
}

export type StartupPhase = 'authentication' | 'foundations' | 'units-and-projects' | 'ready';
export type StartupStatus = 'loading' | 'ready' | 'error' | 'offline' | 'signed-out';

export interface StartupState {
  status: StartupStatus;
  phase: StartupPhase;
  message: string;
  attempt: number;
  startedAt: number;
  elapsedMs?: number;
  failedResource?: string;
}

export const STARTUP_TIMEOUT_MS = 12_000;

class StartupRequestError extends Error {
  constructor(
    public readonly resource: string,
    public readonly originalError: unknown,
  ) {
    super(`Failed loading ${resource}`);
    this.name = 'StartupRequestError';
  }
}

@Injectable({
  providedIn: 'root',
})
/**
 * The global state for the current user. This uses replay subjects, which acts as subjects, but allow
 * for subscribers to request the previously emitted value.
 *
 * This maintains two sets of values:
 * - Units taught and subjects studied
 * - Current view and selected entity
 */
export class GlobalStateService implements OnDestroy {
  /**
   * The current view and entity, indicating what kind of page is being shown.
   */
  public currentViewAndEntitySubject$: BehaviorSubject<DoubtfireViewState> =
    new BehaviorSubject<DoubtfireViewState | null>(null);

  /**
   * The unit roles loaded from the server
   */
  public loadedUnitRoles: EntityCache<UnitRole>;

  /**
   * The loaded units.
   */
  public loadedUnits: EntityCache<Unit>;

  /**
   * The loaded projects.
   */
  public currentUserProjects: EntityCache<Project>;

  private _showFooter = false;
  private _isInboxState = false;
  private _showFooterWarning = false;

  /**
   * A Unit Role for when a tutor is viewing a Project.
   */
  // public get unitRoleSubject(): Observable<UnitRole>;

  /**
   * The list of all of the units taught by the current user
   */
  public get unitRolesSubject(): Observable<UnitRole[]> {
    return this.loadedUnitRoles.values;
  }

  /**
   * The list of all of the units studied by the current user
   */
  public get projectsSubject(): Observable<Project[]> {
    return this.currentUserProjects.values;
  }

  /**
   * This keeps track of whether the application is loading data or not. This is used to
   * protect views from attempting to access details before they are loaded.
   */
  public isLoadingSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);
  public projectLoadErrorSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  /**
   * A finite, user-visible bootstrap state. isLoadingSubject remains for older
   * consumers that only need ready/not-ready, while this state distinguishes
   * active work from a recoverable terminal failure.
   */
  public startupStateSubject: BehaviorSubject<StartupState> = new BehaviorSubject<StartupState>({
    status: 'loading',
    phase: 'authentication',
    message: 'Checking your session…',
    attempt: 0,
    startedAt: Date.now(),
  });

  public showHideHeader: Subject<boolean> = new Subject<boolean>();

  private startupAttempt = 0;
  private globalsSubscription?: Subscription;
  private readonly resetHeightListener = () => this.resetHeight();

  constructor(
    private unitRoleService: UnitRoleService,
    private unitService: UnitService,
    private userService: UserService,
    private authenticationService: AuthenticationService,
    private projectService: ProjectService,
    private campusService: CampusService,
    private teachingPeriodService: TeachingPeriodService,
    private learningOutcomeService: LearningOutcomeService,
    private feedbackTemplateService: FeedbackTemplateService,
    private router: Router,
    private alerts: AlertService,
    private breakpointObserver: BreakpointObserver,
    private authReturnUrl: AuthReturnUrlService,
  ) {
    this.loadedUnitRoles = this.unitRoleService.cache;
    this.loadedUnits = this.unitService.cache;
    this.currentUserProjects = this.projectService.cache;

    this.authenticateFromRefreshToken();

    // this is a hack to workaround horrific IOS "feature"
    // https://stackoverflow.com/questions/37112218/css3-100vh-not-constant-in-mobile-browser

    window.addEventListener('orientationchange', this.resetHeightListener);
    window.addEventListener('resize', this.resetHeightListener);
    this.resetHeight();
  }

  private authenticateFromRefreshToken(): void {
    const startedAt = Date.now();
    // Verification uses its own one-time token and must work in a signed-out
    // email browser, even if a saved session is expired or unavailable.
    if (this.isPublicVerificationRoute()) {
      this.completeSignedOutStartup(startedAt);
      return;
    }
    this.startupAttempt += 1;
    this.isLoadingSubject.next(true);
    this.publishStartupState({
      status: 'loading',
      phase: 'authentication',
      message: 'Checking your session…',
      attempt: this.startupAttempt,
      startedAt,
    });

    this.authenticationService.attemptLoginUsingRefreshToken(
      (result: boolean, failureReason?: RefreshTokenFailureReason) => {
        if (result) {
          this.recordStartupDiagnostic('authentication', 'ready', startedAt);
          if (
            this.userService.currentUser.hasRunFirstTimeSetup === false &&
            window.location.pathname !== '/welcome'
          ) {
            void this.router.navigateByUrl('/welcome');
          }
          return;
        }

        if (
          failureReason === 'offline' ||
          failureReason === 'timeout' ||
          failureReason === 'unavailable'
        ) {
          this.publishStartupFailure('authentication', startedAt, failureReason);
          return;
        }

        this.completeSignedOutStartup(startedAt);
      },
    );
  }

  private completeSignedOutStartup(startedAt: number): void {
    this.isLoadingSubject.next(false);
    this.publishStartupState({
      status: 'signed-out',
      phase: 'authentication',
      message: '',
      attempt: this.startupAttempt,
      startedAt,
      elapsedMs: Date.now() - startedAt,
    });
    this.recordStartupDiagnostic('authentication', 'signed-out', startedAt);

    if (window.location.pathname !== '/sign_in' && !this.isPublicVerificationRoute()) {
      this.authReturnUrl.rememberCurrentUrl();
      void this.router.navigateByUrl('/sign_in');
    }
  }

  private isPublicVerificationRoute(): boolean {
    return window.location.pathname.replace(/\/$/, '') === '/verify_additional_email';
  }

  private resetHeight() {
    setTimeout(() => {
      const vh = window.innerHeight * 0.01;

      if (this._isInboxState) {
        document.body.style.setProperty('--vh', `${vh}px`);
      } else if (!this.breakpointObserver.isMatched('(min-width: 960px)') || !this._showFooter) {
        document.body.style.setProperty('--vh', `${vh - 0.2}px`);
      } else {
        if (this._showFooter && !this._showFooterWarning) {
          document.body.style.setProperty('--vh', `${vh - 0.85}px`);
        } else {
          document.body.style.setProperty('--vh', `${vh - 0.85 - 0.2}px`);
        }
      }
    }, 0);
  }

  public get isInboxState(): boolean {
    return this._isInboxState;
  }

  public setInboxState() {
    this._isInboxState = true;
    // THM-M01: inbox grey, was hardcoded #f5f5f5 inline. Onto the page token so it
    // follows the resolved theme; the fallback keeps the legacy value pre-boot.
    document.body.style.setProperty('background-color', 'var(--ot-color-page, #f5f5f5)');
    this.resetHeight();
  }

  public goHome() {
    this.showHeader();
    document.body.style.setProperty('background-color', 'var(--ot-color-page, #f5f5f5)');
  }

  public setNotInboxState() {
    this._isInboxState = false;
    // Hand the page back to the stylesheet. Painting it the surface colour here made
    // every page after the inbox match its own cards, so the cards lost their edge.
    document.body.style.removeProperty('background-color');
    this.resetHeight();
  }

  public showFooter(): void {
    this._showFooter = true;
    this.resetHeight();
  }

  public hideFooter(): void {
    this._showFooter = false;
    this.resetHeight();
  }

  // called when we need to set the footer to be a bit taller
  // to account for the alert div
  public showFooterWarning(): void {
    if (!this._showFooter) {
      return;
    }
    this._showFooterWarning = true;
    this.resetHeight();
  }

  // called when we need to set the footer to be normal sized
  public hideFooterWarning(): void {
    if (!this._showFooter) {
      return;
    }
    this._showFooterWarning = false;
    this.resetHeight();
  }

  public signOut(): void {
    // Show loading splash, and clear data.
    this.isLoadingSubject.next(true);
    this.userService.cache.clear();
    this.clearUnitsAndProjects();
    this.isLoadingSubject.next(false);
    this.publishStartupState({
      status: 'signed-out',
      phase: 'authentication',
      message: '',
      attempt: this.startupAttempt,
      startedAt: Date.now(),
    });
    this.authenticationService.signOut();
  }

  public ngOnDestroy(): void {
    this.globalsSubscription?.unsubscribe();
    window.removeEventListener('orientationchange', this.resetHeightListener);
    window.removeEventListener('resize', this.resetHeightListener);
    this.isLoadingSubject.complete();
    this.startupStateSubject.complete();
    this.projectLoadErrorSubject.complete();
    this.showHideHeader.complete();
    this.currentViewAndEntitySubject$.complete();
  }

  public loadGlobals(): void {
    this.globalsSubscription?.unsubscribe();
    const startedAt = Date.now();
    this.startupAttempt += 1;
    this.projectLoadErrorSubject.next(false);
    this.isLoadingSubject.next(true);
    this.publishStartupState({
      status: 'loading',
      phase: 'foundations',
      message: 'Loading OnTrack…',
      attempt: this.startupAttempt,
      startedAt,
    });

    this.loadOptionalStaffGlobals();

    const foundations$ = forkJoin([
      this.requiredStartupRequest('campuses', this.campusService.query()),
      this.requiredStartupRequest('teaching periods', this.teachingPeriodService.query()),
    ]);

    this.globalsSubscription = foundations$
      .pipe(
        tap(() => {
          this.publishStartupState({
            status: 'loading',
            phase: 'units-and-projects',
            message: 'Loading your units…',
            attempt: this.startupAttempt,
            startedAt,
          });
        }),
        switchMap(() =>
          forkJoin([
            this.requiredStartupRequest('unit roles', this.unitRoleService.query()),
            this.loadCurrentUserProjects(),
          ]),
        ),
        timeout({first: STARTUP_TIMEOUT_MS}),
      )
      .subscribe({
        next: () => this.completeGlobalLoad(startedAt),
        error: (error: unknown) => this.failGlobalLoad(startedAt, error),
      });
  }

  /**
   * Query the projects the current user studies. A failure here does not stop startup:
   * it opens the loading gate with projectLoadErrorSubject set, so views can render a
   * recoverable project error instead of blocking the whole application.
   */
  private loadCurrentUserProjects(): Observable<Project[]> {
    return this.projectService
      .query(undefined, {
        params: {
          include_inactive: false,
          include_task_definitions: true,
        },
      })
      .pipe(
        catchError(() => {
          this.projectLoadErrorSubject.next(true);
          this.alerts.error('Unable to access the units you study.', 6000);
          return of([] as Project[]);
        }),
      );
  }

  public retryStartup(): void {
    if (this.startupStateSubject.value.phase === 'authentication') {
      this.authenticateFromRefreshToken();
    } else if (this.authenticationService.isAuthenticated()) {
      this.loadGlobals();
    } else {
      this.authenticateFromRefreshToken();
    }
  }

  public continueToSignIn(): void {
    const startedAt = Date.now();
    this.completeSignedOutStartup(startedAt);
  }

  private requiredStartupRequest<T>(resource: string, request: Observable<T>): Observable<T> {
    return request.pipe(
      catchError((error: unknown) => throwError(() => new StartupRequestError(resource, error))),
    );
  }

  private loadOptionalStaffGlobals(): void {
    if (!this.userService.currentUser.isStaff) {
      return;
    }

    this.learningOutcomeService
      .query({}, {endpointFormat: LearningOutcomeService.globalEndpoint})
      .subscribe({
        error: () => {
          this.alerts.error('Unable to access service. Failed loading GLOs.', 6000);
        },
      });

    this.feedbackTemplateService
      .query({}, {endpointFormat: FeedbackTemplateService.globalEndpoint})
      .subscribe({
        error: () => {
          this.alerts.error(
            'Unable to access service. Failed loading GLO feedback templates.',
            6000,
          );
        },
      });
  }

  private completeGlobalLoad(startedAt: number): void {
    const elapsedMs = Date.now() - startedAt;
    this.publishStartupState({
      status: 'ready',
      phase: 'ready',
      message: '',
      attempt: this.startupAttempt,
      startedAt,
      elapsedMs,
    });
    this.isLoadingSubject.next(false);
    this.recordStartupDiagnostic('globals', 'ready', startedAt);
  }

  private failGlobalLoad(startedAt: number, error: unknown): void {
    const failedResource =
      error instanceof StartupRequestError ? error.resource : 'startup services';
    this.publishStartupFailure('units-and-projects', startedAt, undefined, failedResource, error);
  }

  private publishStartupFailure(
    phase: StartupPhase,
    startedAt: number,
    failureReason?: RefreshTokenFailureReason,
    failedResource?: string,
    error?: unknown,
  ): void {
    const offline = failureReason === 'offline' || this.isOffline;
    const timedOut = failureReason === 'timeout' || error instanceof TimeoutError;
    const status: StartupStatus = offline ? 'offline' : 'error';
    const message = offline
      ? 'You appear to be offline. Check your connection and try again.'
      : timedOut
        ? 'OnTrack is taking longer than expected. Try again when your connection is stable.'
        : failedResource
          ? `OnTrack could not load ${failedResource}. Please try again.`
          : 'OnTrack could not finish starting. Please try again.';

    this.publishStartupState({
      status,
      phase,
      message,
      attempt: this.startupAttempt,
      startedAt,
      elapsedMs: Date.now() - startedAt,
      failedResource,
    });
    this.recordStartupDiagnostic(phase, status, startedAt, failedResource);
  }

  private get isOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  private publishStartupState(state: StartupState): void {
    this.startupStateSubject.next(state);
  }

  private recordStartupDiagnostic(
    phase: string,
    outcome: string,
    startedAt: number,
    resource?: string,
  ): void {
    console.info('[OnTrack bootstrap]', {
      phase,
      outcome,
      resource,
      attempt: this.startupAttempt,
      elapsedMs: Date.now() - startedAt,
    });
  }

  /**
   * The passed in function is called after the global user data is loaded.
   * This is only called once, and then the subscription is removed.
   *
   * @param run the function to run
   */
  public onLoad(run: () => void): void {
    const subscription = this.isLoadingSubject.subscribe((loading: boolean) => {
      // Only when the subject changes to "not loading"
      if (!loading) {
        run();
        setTimeout(() => subscription.unsubscribe());
      }
    });
  }

  /**
   * Clear all of the project and unit role data on sign out
   */
  public clearUnitsAndProjects(): void {
    this.projectLoadErrorSubject.next(false);
    this.loadedUnits.clear();
    this.loadedUnitRoles.clear();
    this.userService.cache.clear();
    this.currentUserProjects.clear();
  }

  /**
   * Switch to a new view, and its associated entity object
   */
  public setView(kind: ViewType, entity?: Project | Unit | UnitRole): void {
    this.currentViewAndEntitySubject$.next({viewType: kind, entity: entity});
  }

  /**
   * Show the header
   */
  public showHeader(): void {
    this.showHideHeader.next(true);
  }

  /**
   * Show the header
   */
  public hideHeader(): void {
    this.showHideHeader.next(false);
  }
}
