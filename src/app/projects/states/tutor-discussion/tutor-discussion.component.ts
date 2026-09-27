import {
  Html5Qrcode,
  Html5QrcodeCameraScanConfig,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode';
import {DOCUMENT} from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatDialog} from '@angular/material/dialog';
import {MatSelectionList} from '@angular/material/list';
import {MatTabChangeEvent} from '@angular/material/tabs';
import {ActivatedRoute, ParamMap, Router, convertToParamMap} from '@angular/router';
import {combineLatest, of} from 'rxjs';
import {
  AuthenticationService,
  Project,
  ProjectService,
  Task,
  TaskCommentService,
  TaskDefinition,
  TaskService,
  TaskStatusEnum,
  TutorialStream,
  Unit,
  UnitRole,
  UnitService,
  UserService,
} from 'src/app/api/models/doubtfire-model';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {DiscussedInClassReasonModalService} from 'src/app/common/modals/discussed-in-class-reason-modal/discussed-in-class-reason-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {AddEngagementDialogComponent} from '../dashboard/directives/progress-dashboard/engagement-passport-card/add-engagement-dialog/add-engagement-dialog.component';
import {GlobalStateService} from '../index/global-state.service';

enum TutorDiscussionTabView {
  SHOW_COMMENTS,
  SHOW_STAFF_NOTES,
  SHOW_DISCUSSION_PROMPTS,
}

/** Why the camera could not be used, so the page can say what to do about it. */
export type CameraProblem = 'unsupported' | 'no-camera' | 'denied' | 'busy' | 'failed';

export const CAMERA_PROBLEMS: Record<CameraProblem, {title: string; detail: string}> = {
  'unsupported': {
    title: 'This browser cannot use a camera here',
    detail:
      'Open this page in a recent version of Chrome, Edge, Firefox or Safari, over a secure connection.',
  },
  'no-camera': {
    title: 'No camera found',
    detail: 'Connect a camera, or open this page on a phone or tablet.',
  },
  'denied': {
    title: 'Camera access is blocked',
    detail: 'Allow the camera for this site in your browser settings, then try again.',
  },
  'busy': {
    title: 'The camera is in use',
    detail: 'Another app or tab is using it. Close that, then try again.',
  },
  'failed': {
    title: 'The camera did not start',
    detail: 'Try again. If it keeps failing, reload the page.',
  },
};

/**
 * Sort a camera error into something the tutor can act on. The scanner hands back the
 * browser's own error, or a string with the error's name inside it.
 */
export function cameraProblemFrom(error: unknown): CameraProblem {
  const details = error as {name?: string; message?: string} | null;
  const text = `${details?.name ?? ''} ${details?.message ?? error}`;
  if (/NotAllowed|Permission|SecurityError/i.test(text)) {
    return 'denied';
  }
  if (/NotFound|DevicesNotFound|Overconstrained|not found/i.test(text)) {
    return 'no-camera';
  }
  if (/NotReadable|TrackStart|Could not start|in use/i.test(text)) {
    return 'busy';
  }
  if (/not supported/i.test(text)) {
    return 'unsupported';
  }
  return 'failed';
}

/** The part of the camera scanner this page uses, so a spec can hand it a stand-in. */
export interface QrScanner {
  start(
    camera: string | MediaTrackConstraints,
    config: Html5QrcodeCameraScanConfig,
    onScan: (decodedText: string) => void,
    onScanFailure: () => void,
  ): Promise<unknown>;
  stop(): Promise<void>;
  pause(shouldPauseVideo?: boolean): void;
  resume(): void;
  clear(): void;
  getState(): Html5QrcodeScannerState;
  getRunningTrackSettings(): MediaTrackSettings;
}

export interface CameraOption {
  id: string;
  label: string;
}

const QR_READER_ID = 'qr-reader';
// The scanner keeps its own preference under this key. Reuse it, so the camera a tutor
// picked before this page changed is still the one it opens with.
const CAMERA_STORAGE_KEY = 'HTML5_QRCODE_DATA';
const NOT_IN_UNIT = 'That student is not enrolled in this unit.';
const NOT_A_STUDENT_CODE = "That QR code is not a student's code.";

@Component({
  selector: 'f-tutor-discussion',
  templateUrl: './tutor-discussion.component.html',
  styleUrl: './tutor-discussion.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TutorDiscussionComponent implements OnInit, OnDestroy {
  private readonly discussedInClassNotePrefix = `I'm manually marking this discussed in class because...`;
  private readonly mobileDiscussionViewportContent =
    'width=device-width, initial-scale=0.8, maximum-scale=5';

  @Input() unitId: number;
  @Input() username: string;
  @Input() attendance: boolean;

  @ViewChild('tasks') tasksList: MatSelectionList;
  selectedTaskDefinition: TaskDefinition | null = null;

  public filteredTasks: Task[] = [];
  public allTasks: Task[] = [];
  public showingAllSubmitted = false;

  public unit: Unit | null;
  public project: Project | null;

  public selectedTask: Task | null;

  /** The camera view is on screen. */
  public scanningQr: boolean = false;
  /** Waiting for the camera to start, which includes the browser's permission prompt. */
  public cameraStarting = false;
  public loadingStudentData: boolean = false;
  public loadingUnit = false;

  public cameraProblem: CameraProblem | null = null;
  public readonly cameraProblems = CAMERA_PROBLEMS;
  /** A note under the camera view, such as a code that is not a student's. */
  public scanHint: string | null = null;
  /** Why the page could not open the unit or the student it was asked for. */
  public loadError: string | null = null;

  public cameras: CameraOption[] = [];
  public selectedCameraId: string | null = null;
  public studentLookup = '';

  public readonly externalName = inject(DoubtfireConstants).ExternalName;

  private qrScanner?: QrScanner;
  // The scanner whose start() has not settled yet. Its own start flow releases it, so
  // nothing else may stop or clear it while the camera is coming up.
  private startingScanner?: QrScanner;
  // Bumped whenever the page moves on, so a late answer to an older request is dropped
  // instead of replacing what the tutor has opened since.
  private loadGeneration = 0;
  private unitLoadGeneration = 0;
  private originalViewportContent: string | null = null;
  private mobileDiscussionZoomApplied = false;
  private readonly destroyRef = inject(DestroyRef);
  private destroyed = false;

  private _unitId: number;
  private _username: string | null;
  private _projectId: number | null = null;
  private pageKey: string | null = null;

  public TutorDiscussionTabView = TutorDiscussionTabView;
  public footerTabView: TutorDiscussionTabView = TutorDiscussionTabView.SHOW_COMMENTS;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private unitService: UnitService,
    private authService: AuthenticationService,
    private userService: UserService,
    private projectService: ProjectService,
    private gradeService: GradeService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private alertService: AlertService,
    private confirmationModalService: ConfirmationModalService,
    private discussedInClassReasonModal: DiscussedInClassReasonModalService,
    private taskCommentService: TaskCommentService,
    private taskService: TaskService,
    private dialog: MatDialog,
    private globalState: GlobalStateService,
    private changeDetector: ChangeDetectorRef,
  ) {}

  public ngOnInit(): void {
    this.attendance =
      this.attendance ??
      this.activatedRoute.snapshot.data.attendance ??
      this.activatedRoute.snapshot.queryParamMap.get('attendance') === 'true';

    // The router keeps this page when only the unit in the url or the query changes, for
    // example when a tutor moves to another unit's Discussion from the menu, or opens a
    // second student's code link. Follow both, so the page never shows the last one.
    const parentParams = this.activatedRoute.parent?.paramMap ?? of(convertToParamMap({}));
    combineLatest([parentParams, this.activatedRoute.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, query]) => this.openFromRoute(params, query));
  }

  public ngOnDestroy(): void {
    this.destroyed = true;
    this.stopQrScanner();
    this.restoreViewportZoom();
  }

  /** The units this person teaches now, offered when the page has no unit to work in. */
  public get teachingUnits(): UnitRole[] {
    return (this.globalState.loadedUnitRoles?.currentValues ?? []).filter(
      (unitRole) => unitRole?.unit?.isActive,
    );
  }

  public get hasUnit(): boolean {
    return !!this._unitId;
  }

  public get cameraSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      window.isSecureContext !== false
    );
  }

  public get canStartScanning(): boolean {
    return (
      !this.cameraStarting &&
      !this.loadingStudentData &&
      this.cameraProblem !== 'unsupported' &&
      (!this.attendance || !!this.selectedTaskDefinition)
    );
  }

  public get canFindStudent(): boolean {
    return (
      this.hasUnit &&
      this.studentLookup.trim().length > 0 &&
      !this.loadingStudentData &&
      (!this.attendance || !!this.selectedTaskDefinition)
    );
  }

  public get selectedTaskCount(): number {
    return this.selectedCount(this.tasksList);
  }

  public selectedCount(list?: MatSelectionList): number {
    return list?.selectedOptions?.selected.length ?? 0;
  }

  public currentUserTutorsInStream(tutorialStream: TutorialStream): boolean {
    const user = this.userService.currentUser;
    if (!tutorialStream || !user) {
      return false;
    }
    // A tutorial can have no stream or no tutor, so guard both rather than throw while
    // the task list renders.
    return (this.unit?.tutorials ?? []).some(
      (t) =>
        t.tutorialStream?.abbreviation === tutorialStream.abbreviation &&
        t.tutorialStream?.name === tutorialStream.name &&
        t.tutor?.id === user.id,
    );
  }

  /** Tasks the tutor most likely wants to act on start out ticked. */
  public isPreselected(task: Task): boolean {
    return (
      (['discuss', 'rediscuss'].includes(task.status) || !!this.attendance) &&
      (!task.definition?.lockAssessmentsToTutorialStream ||
        this.currentUserTutorsInStream(task.definition.tutorialStream))
    );
  }

  onTabChange(event: MatTabChangeEvent): void {
    if (event.index === 0) {
      this.showComments();
    } else if (event.index === 1) {
      this.showStaffNotes();
    } else if (event.index === 2) {
      this.showDiscussionPrompts();
    }
  }

  public showComments() {
    this.footerTabView = TutorDiscussionTabView.SHOW_COMMENTS;
  }

  public showStaffNotes() {
    this.footerTabView = TutorDiscussionTabView.SHOW_STAFF_NOTES;
  }

  public showDiscussionPrompts() {
    this.footerTabView = TutorDiscussionTabView.SHOW_DISCUSSION_PROMPTS;
  }

  private openFromRoute(params: ParamMap, query: ParamMap): void {
    const unitId = Number(this.unitId ?? params.get('unitId') ?? query.get('unitId')) || null;
    const username = this.username ?? query.get('username');
    const key = `${unitId}|${username ?? ''}`;
    if (key === this.pageKey) {
      return;
    }
    const isFirstOpen = this.pageKey === null;
    this.pageKey = key;
    if (!isFirstOpen) {
      this.resetPage();
    }

    this.authService.afterAuthCall((result) => {
      if (!result) {
        return this.router.navigateByUrl('/sign_in');
      }
      if (this.userService.currentUser.systemRole === 'Student') {
        // Nothing here is for a student, and the guard is about to send them away.
        return;
      }
      if (!this.cameraSupported) {
        this.cameraProblem = 'unsupported';
      } else if (isFirstOpen) {
        this.watchCameraPermission();
      }
      if (!unitId) {
        return;
      }
      this._unitId = unitId;
      if (username && !this.attendance) {
        this._username = username;
        this._projectId = null;
        this.getStudentTasks();
      } else {
        this.loadUnit();
      }
    });
  }

  private resetPage(): void {
    this.loadGeneration++;
    this.unitLoadGeneration++;
    this.loadingUnit = false;
    this.stopQrScanner();
    this.restoreViewportZoom();
    this.scanningQr = false;
    this.loadingStudentData = false;
    this.unit = null;
    this.project = null;
    this.selectedTask = null;
    this.selectedTaskDefinition = null;
    this.filteredTasks = [];
    this.allTasks = [];
    this.showingAllSubmitted = false;
    this.loadError = null;
    this.scanHint = null;
    this._unitId = undefined;
    this._username = null;
    this._projectId = null;
  }

  private loadUnit(): void {
    const generation = ++this.unitLoadGeneration;
    const isCurrent = () => generation === this.unitLoadGeneration && !this.destroyed;
    this.loadingUnit = true;
    this.loadError = null;
    this.getUnit()
      .then((unit) => {
        // A student opened in the meantime brings their own copy of the unit.
        if (isCurrent() && !this.project) {
          this.unit = unit;
        }
      })
      .catch(() => {
        if (isCurrent()) {
          this.loadError = 'This unit could not be loaded. Reload the page to try again.';
        }
      })
      .finally(() => {
        if (isCurrent()) {
          this.loadingUnit = false;
        }
      });
  }

  private decodeQrCode(data: string) {
    if (!this.scanningQr || this.loadingStudentData) {
      return;
    }

    let params: URLSearchParams;
    try {
      params = new URL(data).searchParams;
    } catch {
      this.scanHint = NOT_A_STUDENT_CODE;
      return;
    }

    const unitId = parseInt(params.get('unitId'));
    const projectId = parseInt(params.get('projectId'));
    const username = params.get('username');

    if ((isNaN(unitId) || isNaN(projectId)) && !username) {
      this.scanHint = NOT_A_STUDENT_CODE;
      return;
    }

    // Check-in records a task from this unit, so a code from another unit cannot count.
    if (this.attendance && this.unit && !isNaN(unitId) && unitId !== this.unit.id) {
      this.scanHint = "That student's code is for a different unit.";
      return;
    }

    this.scanHint = null;
    if (unitId) {
      this._unitId = unitId;
    }
    // A code with only a project id used to fall back on whichever student was scanned
    // last. Look it up by the project instead.
    this._username = username || null;
    this._projectId = username || isNaN(projectId) ? null : projectId;

    this.changeProject();
  }

  /** Close the camera and go back to the page, keeping any student already open. */
  public closeQrReader(): void {
    this.scanningQr = false;
    this.scanHint = null;
    this.stopQrScanner();
  }

  private changeProject() {
    this.pauseScanner();
    this.getStudentTasks();
  }

  /** Look a student up by username or student id, for when there is no camera. */
  public findStudent(): void {
    if (!this.canFindStudent) {
      return;
    }
    this._username = this.studentLookup.trim();
    this._projectId = null;
    this.getStudentTasks();
  }

  private applyMobileDiscussionZoom(): void {
    if (!window.matchMedia?.('(max-width: 768px)').matches) {
      return;
    }

    const viewport = this.document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!viewport) {
      return;
    }

    this.originalViewportContent ??= viewport.getAttribute('content');
    viewport.setAttribute('content', this.mobileDiscussionViewportContent);
    this.mobileDiscussionZoomApplied = true;
  }

  private restoreViewportZoom(): void {
    if (!this.mobileDiscussionZoomApplied) {
      return;
    }

    const viewport = this.document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (viewport && this.originalViewportContent) {
      viewport.setAttribute('content', this.originalViewportContent);
    }

    this.mobileDiscussionZoomApplied = false;
  }

  /** Builds the camera scanner. A spec replaces this with a stand-in. */
  protected createQrScanner(elementId: string): QrScanner {
    return new Html5Qrcode(elementId, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
  }

  private async stopQrScanner(): Promise<void> {
    const scanner = this.qrScanner;
    this.qrScanner = undefined;
    if (!scanner || scanner === this.startingScanner) {
      // A camera that is still starting is let go by its own start flow once it settles.
      return;
    }
    await this.releaseScanner(scanner);
  }

  private async releaseScanner(scanner: QrScanner): Promise<void> {
    try {
      const state = scanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop();
      }
      scanner.clear();
    } catch (_e) {
      // The camera may already be closed. Either way it is let go.
    }
  }

  private pauseScanner(): void {
    try {
      if (this.qrScanner?.getState() === Html5QrcodeScannerState.SCANNING) {
        this.qrScanner.pause(true);
      }
    } catch (_e) {
      // Not scanning, so there is nothing to pause.
    }
  }

  private resumeScanner(): void {
    try {
      if (this.qrScanner?.getState() === Html5QrcodeScannerState.PAUSED) {
        this.qrScanner.resume();
      }
    } catch (_e) {
      // Resuming failed, so start the camera over.
      this.scanQrCode();
    }
  }

  private rememberedCameraId(): string | null {
    try {
      return (
        JSON.parse(localStorage.getItem(CAMERA_STORAGE_KEY) ?? 'null')?.lastUsedCameraId ?? null
      );
    } catch (_e) {
      return null;
    }
  }

  private rememberCamera(cameraId: string | null): void {
    try {
      if (cameraId) {
        localStorage.setItem(
          CAMERA_STORAGE_KEY,
          JSON.stringify({hasPermission: true, lastUsedCameraId: cameraId}),
        );
      } else {
        localStorage.removeItem(CAMERA_STORAGE_KEY);
      }
    } catch (_e) {
      // Storage can be unavailable, for example in a private window. Nothing to keep.
    }
  }

  /**
   * Start the camera and scan for a student's code. The browser only asks for the camera
   * here, when the tutor has chosen to scan, never when the page opens.
   */
  public async scanQrCode(): Promise<void> {
    if (this.attendance && !this.selectedTaskDefinition) {
      this.alertService.error('Choose a task to check in first', 3000);
      return;
    }
    if (!this.cameraSupported) {
      this.cameraProblem = 'unsupported';
      return;
    }
    if (this.cameraStarting) {
      return;
    }

    this.cameraProblem = null;
    this.scanHint = null;
    this.loadError = null;
    this.loadingStudentData = false;
    this.scanningQr = true;

    if (this.qrScanner?.getState() === Html5QrcodeScannerState.PAUSED) {
      this.resumeScanner();
      return;
    }

    // Claim the camera before the first wait, so nothing else can start one while the
    // old scanner is still being stopped.
    this.cameraStarting = true;
    try {
      await this.stopQrScanner();
      if (this.destroyed || !this.scanningQr) {
        return;
      }
      // Draw the camera view first: the scanner sizes the video to the element it is given.
      this.changeDetector.detectChanges();
      await this.startCamera(this.selectedCameraId ?? this.rememberedCameraId());
    } finally {
      this.cameraStarting = false;
    }
  }

  /**
   * Start the camera. Only one start runs at a time: cameraStarting stays true until this
   * one has settled and cleaned up after itself, and the page offers no way to start or
   * switch cameras until then. Two starts at once would both draw into #qr-reader, and
   * the older one's clean up would wipe the newer one's video.
   */
  private async startCamera(cameraId: string | null): Promise<void> {
    this.cameraStarting = true;
    try {
      // Try the camera used last time first. It may be gone, so fall back on letting the
      // browser choose, preferring a camera that faces away from the tutor.
      const attempts = cameraId ? [cameraId, null] : [null];
      for (const [index, attempt] of attempts.entries()) {
        const outcome = await this.startCameraWith(attempt);
        if (outcome === 'started' || outcome === 'cancelled') {
          return;
        }
        const isLastAttempt = index === attempts.length - 1;
        if (outcome === 'denied' || isLastAttempt) {
          this.scanningQr = false;
          this.cameraProblem = outcome;
          return;
        }
        this.rememberCamera(null);
        this.selectedCameraId = null;
      }
    } finally {
      this.cameraStarting = false;
    }
  }

  private async startCameraWith(
    cameraId: string | null,
  ): Promise<'started' | 'cancelled' | CameraProblem> {
    if (this.destroyed || !this.scanningQr) {
      return 'cancelled';
    }

    let scanner: QrScanner;
    try {
      scanner = this.createQrScanner(QR_READER_ID);
    } catch (_e) {
      // The camera view is not on the page, so there is nothing to draw into.
      return this.destroyed ? 'cancelled' : 'failed';
    }

    this.qrScanner = scanner;
    this.startingScanner = scanner;
    let problem: CameraProblem | null = null;
    try {
      await scanner.start(
        cameraId ?? {facingMode: 'environment'},
        {fps: 10, qrbox: (width, height) => this.viewfinderBox(width, height)},
        (decodedText) => this.decodeQrCode(decodedText),
        () => {
          // Most frames hold no code at all. That is not an error worth showing.
        },
      );
    } catch (error) {
      problem = cameraProblemFrom(error);
    }
    this.startingScanner = undefined;

    const stillWanted = !this.destroyed && this.scanningQr && this.qrScanner === scanner;
    if (problem || !stillWanted) {
      if (this.qrScanner === scanner) {
        this.qrScanner = undefined;
      }
      // The tutor stopped, or left, while the camera was starting, or it failed.
      await this.releaseScanner(scanner);
      return stillWanted ? problem : 'cancelled';
    }

    await this.listCameras(scanner);
    return 'started';
  }

  private viewfinderBox(width: number, height: number): {width: number; height: number} {
    const size = Math.max(50, Math.floor(Math.min(width, height) * 0.7));
    return {width: size, height: size};
  }

  /** Once the camera runs its devices have names, so offer a choice if there is one. */
  private async listCameras(scanner: QrScanner): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.cameras = devices
        .filter((device) => device.kind === 'videoinput' && device.deviceId)
        .map((device, index) => ({
          id: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        }));
    } catch (_e) {
      this.cameras = [];
    }

    try {
      this.selectedCameraId = scanner.getRunningTrackSettings()?.deviceId ?? this.selectedCameraId;
    } catch (_e) {
      // The camera closed again before its settings could be read.
    }
  }

  /**
   * Say up front when the browser has already been told to block the camera. This only
   * reads the permission, it never asks for it, and it clears once the tutor allows it.
   */
  private async watchCameraPermission(): Promise<void> {
    if (!navigator.permissions?.query) {
      return;
    }

    try {
      const status = await navigator.permissions.query({name: 'camera' as PermissionName});
      if (this.destroyed) {
        return;
      }
      const update = () => {
        if (status.state === 'denied' && !this.scanningQr) {
          this.cameraProblem = 'denied';
        } else if (status.state !== 'denied' && this.cameraProblem === 'denied') {
          this.cameraProblem = null;
        }
      };
      update();
      // A listener rather than onchange, so the change runs inside the zone and the
      // page updates when the tutor flips the setting.
      status.addEventListener('change', update);
      this.destroyRef.onDestroy(() => status.removeEventListener('change', update));
    } catch (_e) {
      // Some browsers cannot report the camera permission. The camera will tell us instead.
    }
  }

  public async switchCamera(cameraId: string): Promise<void> {
    if (!cameraId || cameraId === this.selectedCameraId || this.cameraStarting) {
      return;
    }
    this.selectedCameraId = cameraId;
    this.rememberCamera(cameraId);
    // Claim the camera before the first wait, so a second switch cannot slip in while
    // this one is still stopping the old camera.
    this.cameraStarting = true;
    try {
      await this.stopQrScanner();
      if (this.scanningQr && !this.destroyed) {
        await this.startCamera(cameraId);
      }
    } finally {
      this.cameraStarting = false;
    }
  }

  public clearCheckInTask(): void {
    this.selectedTaskDefinition = null;
    if (this.scanningQr) {
      this.closeQrReader();
    }
  }

  public openAddEngagementDialog(): void {
    if (!this.project) {
      return;
    }

    this.dialog.open(AddEngagementDialogComponent, {
      data: {project: this.project},
      width: 'calc(100vw - 32px)',
      maxWidth: '640px',
      autoFocus: false,
    });
  }

  public loadTaskComments(event: MouseEvent, task: Task) {
    event.stopPropagation();
    this.selectedTask = task;
    this.showComments();
  }

  public async setSelectedTasksStatus(status: TaskStatusEnum) {
    const selectedTasks = this.tasksList.selectedOptions.selected.map((taskOption) => {
      return taskOption.value as Task;
    });

    if (status === 'complete') {
      const blockedTasks = selectedTasks.filter(
        (task) => !task.definition.assessInPortfolioOnly && !task.canMarkComplete,
      );
      if (blockedTasks.length > 0) {
        this.alertService.error(
          'Some selected tasks cannot be marked as complete until they are marked as discussed in class.',
          5000,
        );
      }
    }

    if (status === 'fix_and_resubmit') {
      try {
        const hasReadyDependents = (
          await Promise.all(
            selectedTasks.map((task) =>
              task?.definition && task?.project ? task.hasReadyForFeedbackDependents() : false,
            ),
          )
        ).some(Boolean);

        if (hasReadyDependents) {
          this.confirmationModalService.show(
            'Move dependent tasks to Fix and Resubmit?',
            'One or more selected tasks are prerequisites for other tasks submitted by this student that are Ready for Feedback. Do you want to move those tasks to Fix and Resubmit as well?',
            () => {
              this.updateSelectedTasksStatus(selectedTasks, status, true);
            },
            () => {
              this.updateSelectedTasksStatus(selectedTasks, status, false);
            },
            'Yes, update dependent tasks',
            'No, just selected tasks',
          );
          return;
        }
      } catch (error) {
        this.alertService.error(`Failed to check dependent task statuses: ${error}`, 6000);
      }
    }

    this.updateSelectedTasksStatus(selectedTasks, status, false);
  }

  private updateSelectedTasksStatus(
    selectedTasks: Task[],
    status: TaskStatusEnum,
    moveDependentTasks: boolean,
  ) {
    for (const task of selectedTasks) {
      if (
        status === 'complete' &&
        !task.definition.assessInPortfolioOnly &&
        !task.canMarkComplete
      ) {
        continue;
      }

      if (task.definition.assessInPortfolioOnly) {
        task.updateTaskStatus(status === 'complete' ? 'working_on_it' : status, true);
      } else if (status === 'fix_and_resubmit') {
        task.updateTaskStatus(status, true, moveDependentTasks);
      } else {
        task.updateTaskStatus(status, true);
      }
    }
  }

  public get canMarkSelectedTasksComplete(): boolean {
    return this.canCompleteSelection(this.tasksList);
  }

  public canCompleteSelection(list?: MatSelectionList): boolean {
    const selectedTasks = list?.selectedOptions?.selected ?? [];
    if (!selectedTasks.length) {
      return false;
    }

    return selectedTasks.every((taskOption) => {
      const task = taskOption.value as Task;
      return task.definition.assessInPortfolioOnly || task.canMarkComplete;
    });
  }

  public get selectedTasksIncludeDiscuss(): boolean {
    return this.selectionIncludesDiscuss(this.tasksList);
  }

  public selectionIncludesDiscuss(list?: MatSelectionList): boolean {
    const selectedTasks = list?.selectedOptions?.selected ?? [];
    return selectedTasks.some((taskOption) => {
      const task = taskOption.value as Task;
      return task.status === 'discuss';
    });
  }

  public markSelectedTasksDicussed() {
    const selectedTasks = this.tasksList.selectedOptions.selected;
    if (!this.unit?.enforceFeedbackBeforeDiscussedInClass) {
      for (const taskOption of selectedTasks) {
        const task = taskOption.value as Task;
        task.markAsDiscussed();
      }
      return;
    }

    this.discussedInClassReasonModal
      .show(
        'Mark Discussed in Class',
        `Add a tutor note explaining why ${selectedTasks.length} task${
          selectedTasks.length === 1 ? '' : 's'
        } ${selectedTasks.length === 1 ? 'is' : 'are'} being marked as discussed in class.`,
        this.discussedInClassNotePrefix,
      )
      .afterClosed()
      .subscribe((reason) => {
        if (!reason) {
          return;
        }

        for (const taskOption of selectedTasks) {
          const task = taskOption.value as Task;
          task.markAsDiscussed(reason);
        }
      });
  }

  public markSelectedTasksCheckedIn() {
    const selectedTasks = this.tasksList.selectedOptions.selected;
    if (selectedTasks.length > 1) {
      this.alertService.error('Can only check-in 1 task at a time', 5000);
      return;
    }
    for (const taskOption of selectedTasks) {
      const task = taskOption.value as Task;
      this.taskService.checkInTaskForStudent(task).subscribe({
        next: () => {
          this.taskService.notifyStatusChange(task);
          this.alertService.success('Successfully checked in', 2500);
        },
        error: (_error) => {
          this.alertService.error('Failed to check-in', 5000);
        },
      });
    }
  }

  private getUnit(): Promise<Unit> {
    return new Promise((resolve, reject) => {
      this.unitService.get({id: this._unitId}).subscribe({
        next: (unit) => {
          setTimeout(() => {
            resolve(unit);
          });
        },
        error: (err) => {
          reject(err);
        },
      });
    });
  }

  private isRequestedStudent(project: Project): boolean {
    if (this._username) {
      const wanted = this._username.trim().toLowerCase();
      const student = project?.student;
      return (
        student?.username?.toLowerCase() === wanted ||
        `${student?.studentId ?? ''}`.toLowerCase() === wanted
      );
    }
    return this._projectId != null && project?.id === this._projectId;
  }

  private loadStudents(unit: Unit): Promise<Project> {
    return new Promise((resolve, reject) => {
      this.projectService.loadStudents(unit, false, false).subscribe({
        next: (projects) => {
          const project = projects.find((p) => this.isRequestedStudent(p));
          if (project) {
            resolve(project);
          } else {
            reject(NOT_IN_UNIT);
          }
        },
        // Without this the promise never settled on a failed request, and the page sat
        // on its loading state for good.
        error: (error) => reject(error),
      });
    });
  }

  private getProject(unit: Unit, projectId: number): Promise<Project> {
    return new Promise((resolve, reject) => {
      this.projectService.loadProject(projectId, unit, true).subscribe({
        next: (project) => {
          if (project) {
            resolve(project);
          } else {
            reject('That student could not be loaded.');
          }
        },
        error: (error) => reject(error),
      });
    });
  }

  public getTargetTradeString(grade: number) {
    return this.gradeService.gradeLabel(grade, this.project?.unit);
  }

  statusesToInclude: TaskStatusEnum[] = [
    'demonstrate',
    'ready_for_feedback',
    'discuss',
    'attention_required',
    'need_help',
    // 'complete',
    'fix_and_resubmit',
    'redo',
    'rediscuss',
  ];

  public viewAllSubmittedTasks() {
    this.filteredTasks = [...this.allTasks];
    this.showingAllSubmitted = true;
  }

  private filteredDiscussionTasks(tasks: readonly Task[]): Task[] {
    return tasks.filter((task) => {
      if (!this.statusesToInclude.includes(task.status)) {
        return false;
      }

      if (
        this.unit?.enforceFeedbackBeforeDiscussedInClass &&
        task.status === 'ready_for_feedback'
      ) {
        return false;
      }

      return true;
    });
  }

  public viewAllFilteredTasks() {
    const discussionTasks = this.filteredDiscussionTasks(this.project?.tasks ?? []);
    this.filteredTasks = [...discussionTasks];
    this.showingAllSubmitted = false;
  }

  /** There are submitted tasks beyond the ones waiting to be discussed. */
  public get hasMoreSubmittedTasks(): boolean {
    return this.allTasks.length > this.filteredDiscussionTasks(this.allTasks).length;
  }

  public getStudentTasks(): void {
    const generation = ++this.loadGeneration;
    const isCurrent = () => generation === this.loadGeneration && !this.destroyed;
    this.loadError = null;
    this.loadingStudentData = true;
    const wasScanning = this.scanningQr;

    this.getUnit()
      .then((_unit) => {
        if (!isCurrent()) {
          return null;
        }
        this.unit = _unit;
        return this.loadStudents(this.unit);
      })
      .then((student) => {
        return student && isCurrent() ? this.getProject(this.unit, student.id) : null;
      })
      .then((project) => {
        if (!project || !isCurrent()) {
          return;
        }
        const discussionTasks = this.filteredDiscussionTasks(project.tasks);
        if (!this.attendance) {
          this.filteredTasks = [...discussionTasks];
          this.allTasks = [
            ...project.tasks.filter(
              (task) =>
                task.status !== 'not_started' && // Filter out tasks with no submissions yet
                task.definition?.targetGrade <= project.targetGrade, // Filter out tasks that are higher than student's target grade
            ),
          ];
        } else {
          const task = project.tasks.find(
            (t) => t.definition?.id === this.selectedTaskDefinition?.id,
          );
          this.filteredTasks = task ? [task] : [];
          this.allTasks = [];
        }

        this.showingAllSubmitted = false;
        this.selectedTask = this.filteredTasks[0] ?? null;
        this.project = project;
        this.studentLookup = '';
        this.scanningQr = false;
        this.scanHint = null;
        this.loadingStudentData = false;
        this.stopQrScanner();
        this.applyMobileDiscussionZoom();
      })
      .catch((e) => {
        if (!isCurrent()) {
          return;
        }
        this.loadingStudentData = false;
        const message =
          typeof e === 'string' && e.length > 0 ? e : 'That student could not be loaded.';
        if (wasScanning && this.scanningQr) {
          // Keep scanning, and say why this code did not open a student.
          this.scanHint = message;
          this.resumeScanner();
        } else {
          this.loadError = message;
        }
      });
  }
}
