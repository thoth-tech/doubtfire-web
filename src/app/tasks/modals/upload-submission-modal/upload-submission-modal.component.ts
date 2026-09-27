import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  Injector,
  OnDestroy,
  OnInit,
  ViewChild,
  afterNextRender,
  inject,
} from '@angular/core';
import {ErrorStateMatcher} from '@angular/material/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {MemberContribution} from 'src/app/api/models/groups/group';
import {Task} from 'src/app/api/models/task';
import {TaskStatus, TaskStatusEnum} from 'src/app/api/models/task-status';
import {ProjectService} from 'src/app/api/services/project.service';
import {TaskService} from 'src/app/api/services/task.service';
import {prefersReducedMotion} from 'src/app/common/celebrate/reduced-motion';
import type {SubmissionCelebration} from 'src/app/common/celebrate/submission-timing';
import {FileUploaderComponent} from 'src/app/common/file-uploader/file-uploader.component';
import {AlertService} from 'src/app/common/services/alert.service';
import {EmojiService} from 'src/app/common/services/emoji.service';
import {PrivacyPolicy} from 'src/app/config/privacy-policy/privacy-policy';
import {summariseUploadRequirement} from './task-upload-requirements/upload-category';

/**
 * The confirmation finishes arriving at about 1.6s. This leaves roughly two more
 * seconds to take it in before the dialog closes itself, and the Done button is
 * there for anyone who would rather not wait.
 */
const SUBMISSION_CELEBRATION_HOLD_MS = 3600;

/**
 * The handover: long enough for the bar to draw into the middle (300ms) and the
 * circle to answer it (from 240ms). Matches the "collapse" timing on
 * /submit-motion, where the six candidates were compared.
 */
const FLOW_SWAP_MS = 480;

type UploadStage = 'group' | 'details' | 'comments';
type UploadSubmissionType = TaskStatusEnum | 'reupload_evidence' | 'test_submission';

interface UploadSubmissionTypeOption {
  id: UploadSubmissionType;
  label: string;
}

export interface UploadSubmissionStep {
  stage: UploadStage;
  label: string;
}

interface UploadSubmissionFileSpec {
  name: string;
  type: string;
}

type UploadSubmissionFileMap = Record<string, UploadSubmissionFileSpec>;

interface TeamData {
  memberContributions: MemberContribution[];
}

interface UploadSubmissionResponse {
  id: number;
  project_id: number;
  status: TaskStatusEnum;
  [key: string]: unknown;
}

export interface UploadSubmissionModalData {
  task: Task;
  reuploadEvidence: boolean;
  isTestSubmission: boolean;
}

export interface UploadSubmissionModalCloseResult {
  value: Task;
}

export interface UploadSubmissionModalDismissResult {
  dismissed: true;
}

export type UploadSubmissionModalResult =
  | UploadSubmissionModalCloseResult
  | UploadSubmissionModalDismissResult;

@Component({
  selector: 'f-upload-submission-modal',
  templateUrl: './upload-submission-modal.component.html',
  styleUrls: ['./upload-submission-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class UploadSubmissionModalComponent implements OnInit, OnDestroy {
  @ViewChild(FileUploaderComponent) private fileUploader?: FileUploaderComponent;
  @ViewChild('groupHeading') private groupHeading?: ElementRef<HTMLElement>;
  @ViewChild('detailsHeading') private detailsHeading?: ElementRef<HTMLElement>;
  @ViewChild('commentsHeading') private commentsHeading?: ElementRef<HTMLElement>;
  @ViewChild('dialogTitle') private dialogTitle?: ElementRef<HTMLElement>;
  @ViewChild('flowAction', {read: ElementRef}) private flowAction?: ElementRef<HTMLElement>;
  private readonly injector = inject(Injector);

  public readonly minCommentLength = 25;
  public readonly task = this.data.task;
  public readonly privacyPolicy = this.privacyPolicyService;
  public readonly fileRequirements: UploadSubmissionFileMap =
    this.task.definition.uploadRequirements.reduce((files, file) => {
      files[file.key] = {
        name: file.name,
        type: file.type,
      };
      return files;
    }, {} as UploadSubmissionFileMap);
  public readonly uploadUrl = this.data.isTestSubmission
    ? this.task.testSubmissionUrl()
    : this.task.submissionUrl();

  public submissionTypeOptions: UploadSubmissionTypeOption[] = [];
  public submissionType: UploadSubmissionType = 'ready_for_feedback';
  public currentStage: UploadStage = 'details';
  public payload: Record<string, unknown> = {};
  public team: TeamData = {memberContributions: []};
  public comment = '';
  public showPlagiarism = false;
  public isUploaderReady = false;
  public uploadStarted = false;
  public uploadSubmitLocked = false;
  public uploadAnnouncement = '';
  public readonly commentErrorStateMatcher: ErrorStateMatcher = {
    isErrorState: (control) =>
      !!control?.touched &&
      this.requiresComment &&
      this.comment.trim().length < this.minCommentLength,
  };
  /** Set once the submission has landed. It takes over the dialog until it closes. */
  public celebration: SubmissionCelebration | null = null;
  /** The handover: the bar collapses and the circle absorbs it. */
  public flowSwapping = false;

  private uploadResponse: UploadSubmissionResponse | null = null;
  /** Guards the status change against running twice, or not at all. */
  private completionApplied = false;
  private startUpload?: () => void;
  private celebrationTimer: ReturnType<typeof setTimeout> | null = null;
  private swapTimer: ReturnType<typeof setTimeout> | null = null;
  private closingAfterUpload = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: UploadSubmissionModalData,
    private dialogRef: MatDialogRef<UploadSubmissionModalComponent, UploadSubmissionModalResult>,
    private taskService: TaskService,
    private projectService: ProjectService,
    private privacyPolicyService: PrivacyPolicy,
    private alertService: AlertService,
    private emojiService: EmojiService,
  ) {}

  ngOnInit(): void {
    this.submissionTypeOptions = this.buildSubmissionTypeOptions();
    this.submissionType = this.data.isTestSubmission
      ? 'test_submission'
      : this.data.reuploadEvidence
        ? 'reupload_evidence'
        : this.task.status;
    this.resetUploadState();
  }

  public get isUploading(): boolean {
    return this.fileUploader?.isUploading ?? false;
  }

  /**
   * Bytes on the wire, as opposed to a request that has landed and is reporting
   * its outcome. `isUploading` covers both, so using it to decide whether the
   * dialog may close left it shut after a failed upload: the error panel offers
   * Try again and Cancel, but Escape and the backdrop did nothing.
   */
  public get uploadInFlight(): boolean {
    return this.fileUploader?.uploadInFlight ?? false;
  }

  public get showGroupSection(): boolean {
    return this.submissionType === 'ready_for_feedback' && this.task.isGroupTask();
  }

  public get showCommentsSection(): boolean {
    return this.submissionType !== 'test_submission';
  }

  public get isDetailsStage(): boolean {
    return this.currentStage === 'details';
  }

  public get isGroupStage(): boolean {
    return this.currentStage === 'group' && this.showGroupSection;
  }

  public get isCommentsStage(): boolean {
    return this.currentStage === 'comments' && this.showCommentsSection;
  }

  public get requiresComment(): boolean {
    return (
      this.submissionType === 'need_help' ||
      ((this.submissionType === 'ready_for_feedback' ||
        this.submissionType === 'reupload_evidence') &&
        this.task.definition.assessInPortfolioOnly)
    );
  }

  public get submitTooltip(): string {
    return this.requiresComment && this.comment.trim().length < this.minCommentLength
      ? 'This submission requires a comment'
      : '';
  }

  public get commentPlaceholder(): string {
    if (this.submissionType === 'need_help') {
      return 'I need help with...';
    }

    if (
      this.submissionType === 'ready_for_feedback' &&
      this.task.definition.assessInPortfolioOnly
    ) {
      return 'I would like feedback with...';
    }

    return 'Make a comment...';
  }

  // ---- The submit panel ----
  // One panel carries the whole thing: the same circle, the same two lines of
  // text and the same bar go from sending to sent to confirmed. Nothing is
  // unmounted and remounted in between, so there is nothing to read as a new
  // screen appearing.

  /** True from the moment Submit is pressed until the dialog closes. */
  public get showSubmitFlow(): boolean {
    return this.uploadStarted && !this.uploadFailed;
  }

  public get uploadFailed(): boolean {
    return this.fileUploader?.uploadingInfo?.success === false;
  }

  public get flowProgress(): number {
    return this.celebration ? 100 : (this.fileUploader?.uploadProgress ?? 0);
  }

  /** The bytes are away. The panel starts becoming the confirmation here. */
  public get flowLanded(): boolean {
    return !!this.celebration || this.fileUploader?.uploadLanded === true;
  }

  public get flowTitle(): string {
    if (this.celebration) {
      return this.celebration.headline;
    }
    return this.flowLanded ? 'Uploaded' : 'Uploading your work';
  }

  public get flowDetail(): string {
    return this.celebration?.detail ?? this.fileUploader?.uploadingFileLabel ?? '';
  }

  public cancelUpload(): void {
    this.fileUploader?.cancelUpload();
  }

  /**
   * The callout above the drop zones only earns its place when it says something
   * they do not. A single requirement is already named, typed and stated as
   * required by its own zone, so repeating it three ways just adds to the page.
   */
  public get showUploadRequirements(): boolean {
    const requirements = this.task.definition.uploadRequirements ?? [];
    if (requirements.length !== 1) {
      return requirements.length > 1;
    }

    const summary = summariseUploadRequirement(requirements[0]);
    return summary.hasMoreExtensions || summary.maxSizeLabel !== null;
  }

  /** The steps this submission goes through, in order. */
  public get steps(): UploadSubmissionStep[] {
    const steps: UploadSubmissionStep[] = [];
    if (this.showGroupSection) {
      steps.push({stage: 'group', label: 'Rate team'});
    }
    steps.push({stage: 'details', label: 'Upload files'});
    if (this.showCommentsSection) {
      steps.push({
        stage: 'comments',
        label: this.submissionType === 'need_help' ? 'Ask for help' : 'Comments',
      });
    }
    return steps;
  }

  public get currentStepIndex(): number {
    return Math.max(
      0,
      this.steps.findIndex((step) => step.stage === this.currentStage),
    );
  }

  /** The task's due or target date, or null when it cannot be worked out. */
  public get dueDate(): Date | null {
    try {
      const date = this.task.localDueDate?.();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    } catch {
      return null;
    }
  }

  public get isPastDue(): boolean {
    try {
      return this.task.isPastDueDate?.() === true;
    } catch {
      return false;
    }
  }

  /** A task status for the icon beside a submission type, when that type is a status. */
  public statusFor(type: UploadSubmissionType): TaskStatusEnum | null {
    return TaskStatus.STATUS_KEYS.includes(type as TaskStatusEnum)
      ? (type as TaskStatusEnum)
      : null;
  }

  public get selectedSubmissionTypeLabel(): string {
    return (
      this.submissionTypeOptions.find((option) => option.id === this.submissionType)?.label ?? ''
    );
  }

  /** Says why the forward button is disabled, or null when it is enabled. */
  public get continueHint(): string | null {
    if (this.isGroupStage) {
      return this.shouldDisableNext() ? 'Rate a team member to continue' : null;
    }

    const forwardDisabled =
      this.isDetailsStage && this.showCommentsSection
        ? this.shouldDisableNext()
        : this.shouldDisableSubmit();
    if (!forwardDisabled) {
      return null;
    }

    if (!this.isUploaderReady) {
      return this.task.definition.uploadRequirements.length > 1
        ? 'Add the required files to continue'
        : 'Add the required file to continue';
    }

    if (this.requiresComment && this.comment.trim().length < this.minCommentLength) {
      return `Add a comment of at least ${this.minCommentLength} characters`;
    }

    return null;
  }

  public get hasRatedTeamMember(): boolean {
    return this.team.memberContributions.some((member) => !!member.rating);
  }

  public shouldDisableNext(): boolean {
    if (this.isGroupStage) {
      return !this.hasRatedTeamMember;
    }

    if (this.isDetailsStage) {
      return !this.isUploaderReady;
    }

    return false;
  }

  public shouldDisableSubmit(): boolean {
    return (
      this.uploadSubmitLocked ||
      (this.showGroupSection && !this.hasRatedTeamMember) ||
      !this.isUploaderReady ||
      (this.requiresComment && this.comment.trim().length < this.minCommentLength)
    );
  }

  public onSubmissionTypeChange(newType: UploadSubmissionType): void {
    if (newType !== 'reupload_evidence' && newType !== 'test_submission') {
      this.task.status = newType as TaskStatusEnum;
    }

    this.submissionType = newType;
    this.resetUploadState();
  }

  public goToCommentsStage(): void {
    if (this.showCommentsSection && !this.shouldDisableNext()) {
      this.currentStage = 'comments';
      this.focusStageHeading();
    }
  }

  public goToGroupStage(): void {
    if (this.showGroupSection) {
      this.currentStage = 'group';
      this.focusStageHeading();
    }
  }

  public goToDetailsStage(): void {
    this.currentStage = 'details';
    this.focusStageHeading();
  }

  private focusStageHeading(): void {
    afterNextRender(
      () => {
        // the header goes once the upload starts, so the panel's one button takes focus
        const heading = this.uploadStarted
          ? (this.flowAction ?? this.dialogTitle)
          : this.isGroupStage
            ? this.groupHeading
            : this.isCommentsStage
              ? this.commentsHeading
              : this.detailsHeading;
        heading?.nativeElement.focus();
      },
      {injector: this.injector},
    );
  }

  public cancel = (): void => {
    this.dialogRef.close({dismissed: true});
  };

  public canClose(): boolean {
    // Material runs this for programmatic closes as well as Escape and the
    // backdrop, so it decides whether the dialog may close itself. The closes
    // this component makes once the server has answered must not be held back
    // or asked about. Once the server has taken the submission there is nothing
    // left to discard, and a prompt here would both lie to the student and veto
    // the dialog's own exit: answering "Cancel" to "discard your files?" would
    // keep them in it.
    if (this.closingAfterUpload || this.celebration || this.uploadResponse) {
      return true;
    }
    // Only bytes on the wire hold the dialog. A failed response hands control
    // back to the student.
    if (this.uploadInFlight) {
      return false;
    }
    if (!this.isDirty) {
      return true;
    }

    return window.confirm('Discard the files and details selected for this submission?');
  }

  public get isDirty(): boolean {
    // The dialog may be dismissed freely until a local file has actually been
    // selected. This avoids warning on an untouched dialog (or after merely
    // inspecting submission options) while protecting the only state that the
    // browser cannot reconstruct after close.
    return this.fileUploader?.hasSelectedFiles() === true;
  }

  public onReadyChange(isReady: boolean): void {
    this.isUploaderReady = isReady;
  }

  public onUploaderReady(startUpload: () => void): void {
    this.startUpload = startUpload;
  }

  public onUploadCancelled = (): void => {
    this.uploadSubmitLocked = false;
    this.uploadStarted = false;
    this.uploadAnnouncement = '';
    this.uploadResponse = null;
    this.currentStage = 'details';
  };

  public onBeforeUpload = (): void => {
    this.uploadAnnouncement = 'Uploading submission. Please wait for the result.';
    this.focusStageHeading();
    Object.keys(this.payload).forEach((key) => delete this.payload[key]);

    if (this.showGroupSection) {
      this.payload['contributions'] = this.mapTeamToPayload();
    }

    if (this.submissionType === 'need_help') {
      this.payload['trigger'] = 'need_help';
    }

    if (
      this.submissionType === 'assess_in_portfolio' ||
      this.task.status === 'assess_in_portfolio'
    ) {
      this.payload['trigger'] = 'assess_in_portfolio';
    }

    const trimmedComment = this.comment.trim();
    if (trimmedComment !== '') {
      this.payload['comment'] = this.emojiService.nativeEmojiToColons(trimmedComment);
    }
  };

  public onUploadSuccess = (response: unknown): void => {
    if (this.isValidUploadResponse(response)) {
      this.uploadResponse = response;
      this.task.processingPdf = true;
      this.task.hasPdf = false;
      this.task.submissionProcessingState = 'queued';
      this.task.submissionRetryable = false;
      this.uploadAnnouncement = 'Submission uploaded successfully.';

      if (this.data.isTestSubmission) {
        this.projectService.loadProject(response.project_id, this.task.unit).subscribe({
          next: (project) => {
            this.task.project = project;
          },
        });
      }

      return;
    }

    console.error('Invalid response', response);
    this.closeAfterUpload();
    this.alertService.error(
      'Upload failed. Please try again, or contact your tutor if the issue continues.',
      8000,
    );
  };

  public onUploadFailure = (): void => {
    // Only the success path cleared this, so after a failed upload the dialog's
    // own Submit stayed locked for good and the uploader's Try again was the
    // only way back.
    this.uploadSubmitLocked = false;
    this.uploadAnnouncement =
      'Submission upload failed. Review the error below, then choose Try again or Cancel.';
  };

  public onUploadComplete = (): void => {
    this.uploadSubmitLocked = false;

    if (!this.uploadResponse?.id) {
      return;
    }

    // The dialog the student started this from is still the thing they are
    // looking at, so the confirmation belongs here rather than over the page
    // they are about to be returned to.
    const celebration = this.applyCompletion(true);

    if (celebration) {
      this.showCelebration(celebration);
      return;
    }

    this.closeAfterUpload();
  };

  /**
   * Fold the response into the task. Done can be pressed in the second or so
   * between the bytes landing and this callback firing, so it runs at most once
   * and either caller may be the one to run it.
   *
   * Leaving early passes `claimCelebration: false`, which hands the moment to
   * the dashboard rather than spending it on a dialog that is already closing.
   */
  private applyCompletion(claimCelebration: boolean): SubmissionCelebration | null {
    if (this.completionApplied || !this.uploadResponse?.id) {
      return null;
    }
    this.completionApplied = true;

    if (this.data.isTestSubmission) {
      return null;
    }

    const response = this.uploadResponse;
    const expectedStatus =
      this.submissionType === 'need_help' || this.submissionType === 'ready_for_feedback'
        ? this.submissionType
        : response.status;

    this.task.updateFromJson(response, this.taskService.mapping);
    return this.task.processTaskStatusChange(
      expectedStatus as TaskStatusEnum,
      this.alertService,
      true,
      claimCelebration,
    );
  }

  /** Hold long enough for the mark to draw and the words to be read, then leave. */
  private showCelebration(celebration: SubmissionCelebration): void {
    this.uploadAnnouncement = celebration.headline;
    if (prefersReducedMotion()) {
      this.celebration = celebration;
      this.celebrationTimer = setTimeout(() => this.finishCelebration(), 900);
      return;
    }

    // Play the handover before swapping the words. Without the pause the text is
    // replaced between two frames, which reads as a cut however well the box
    // around it is transitioning.
    this.flowSwapping = true;
    this.swapTimer = setTimeout(() => {
      this.swapTimer = null;
      this.celebration = celebration;
      this.flowSwapping = false;
      this.celebrationTimer = setTimeout(
        () => this.finishCelebration(),
        SUBMISSION_CELEBRATION_HOLD_MS,
      );
    }, FLOW_SWAP_MS);
  }

  /**
   * Also the Done button, so nobody has to wait out the hold. Done is on screen
   * from the moment the upload lands, which can be before the completion
   * callback has run, so apply what it would have applied before leaving.
   */
  public finishCelebration(): void {
    this.clearFlowTimers();
    this.applyCompletion(false);
    this.dialogRef.close({value: this.task});
  }

  private clearFlowTimers(): void {
    if (this.celebrationTimer) {
      clearTimeout(this.celebrationTimer);
      this.celebrationTimer = null;
    }
    if (this.swapTimer) {
      clearTimeout(this.swapTimer);
      this.swapTimer = null;
    }
  }

  public ngOnDestroy(): void {
    this.clearFlowTimers();
    // The dialog can go before the uploader's completion callback arrives:
    // Escape or the backdrop on the "Uploaded" panel, or Done during the
    // handover. The submission is already on the server either way, so record
    // it, and leave the celebration unclaimed for the dashboard to show. Does
    // nothing when the response never arrived, or has already been applied.
    this.applyCompletion(false);
  }

  public uploadButtonClicked(): void {
    if (this.uploadSubmitLocked || this.uploadInFlight) {
      return;
    }

    this.uploadSubmitLocked = true;
    this.uploadStarted = true;
    this.currentStage = 'details';
    this.startUpload?.();
  }

  private closeAfterUpload(): void {
    this.closingAfterUpload = true;
    this.dialogRef.close({value: this.task});
  }

  private buildSubmissionTypeOptions(): UploadSubmissionTypeOption[] {
    if (this.data.isTestSubmission) {
      return [{id: 'test_submission', label: 'Test Submission'}];
    }

    const options: UploadSubmissionTypeOption[] = this.taskService.submittableStatuses.map(
      (status) => ({
        id: status,
        label: this.taskService.statusLabels.get(status) ?? status,
      }),
    );

    if (this.task.inSubmittedState()) {
      options.push({id: 'reupload_evidence', label: 'New Evidence'});
    }

    return options;
  }

  private resetUploadState(): void {
    this.uploadStarted = false;
    this.uploadAnnouncement = '';
    this.uploadSubmitLocked = false;
    this.uploadResponse = null;
    this.completionApplied = false;
    this.currentStage = this.showGroupSection ? 'group' : 'details';
  }

  private mapTeamToPayload(): {project_id: number; pct: string; pts: number}[] {
    const total = this.task.group?.contributionSum(this.team.memberContributions) ?? 0;

    return this.team.memberContributions.map((member) => ({
      project_id: member.project.id,
      pct: total > 0 ? ((100 * member.rating) / total).toFixed(0) : '0',
      pts: member.rating,
    }));
  }

  private isValidUploadResponse(response: unknown): response is UploadSubmissionResponse {
    const candidate = response as Partial<UploadSubmissionResponse> | null;

    return !!candidate && typeof candidate === 'object' && !!candidate.id && !!candidate.project_id;
  }
}
