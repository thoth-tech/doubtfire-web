import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import {Subscription} from 'rxjs';
import {Task} from 'src/app/api/models/task';
import {TaskService} from 'src/app/api/services/task.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {AppLifecycleService} from 'src/app/common/services/app-lifecycle.service';

@Component({
  selector: 'f-task-submission-card',
  templateUrl: './task-submission-card.component.html',
  styleUrls: ['./task-submission-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskSubmissionCardComponent implements OnChanges, OnInit, OnDestroy {
  @Input() task: Task;

  public pollingPaused = false;
  public refreshFailed = false;
  public retryPending = false;
  private pollAttempt = 0;
  private pollTimer?: number;
  private wasHidden = false;
  private initialized = false;
  private readonly pollDelays = [2000, 3000, 5000, 8000, 13000, 20000, 30000];
  private lifecycleSubscription?: Subscription;

  public get canRegeneratePdf(): boolean {
    return (
      this.taskService.pdfRegeneratableStatuses.includes(this.task?.status) &&
      this.task?.submissionPdfReady &&
      !this.task?.submissionProcessingActive
    );
  }

  public get stateLabel(): string {
    switch (this.task?.submissionProcessingState) {
      case 'queued':
        return 'Queued';
      case 'processing':
        return 'Processing';
      case 'ready':
        return 'Ready';
      case 'failed':
        return 'Processing failed';
      case 'timed_out':
        return 'Processing timed out';
      default:
        return 'Not submitted';
    }
  }

  public get stateMessage(): string {
    switch (this.task?.submissionProcessingState) {
      case 'queued':
        return 'Your files were received and are waiting for conversion.';
      case 'processing':
        return 'OnTrack is creating the submission PDF. You can leave this page and return later.';
      case 'ready':
        return 'Your submission PDF and uploaded files are ready.';
      case 'failed':
        return 'OnTrack could not create the submission PDF. Your uploaded files remain available.';
      case 'timed_out':
        return 'Processing did not finish in the expected time. Retry from the uploaded files below.';
      default:
        return 'No file submission has been received for this task.';
    }
  }

  public get taskPdfUrl(): string {
    return this.task?.submissionUrl(true);
  }

  public get taskFilesUrl(): string {
    return this.task?.submittedFilesUrl();
  }

  constructor(
    private taskService: TaskService,
    private alerts: AlertService,
    private fileDownloader: FileDownloaderService,
    private appLifecycle: AppLifecycleService,
  ) {}

  ngOnInit(): void {
    this.initialized = true;
    this.lifecycleSubscription = this.appLifecycle.stateSubject.subscribe((state) => {
      if (state === 'hidden') {
        this.wasHidden = true;
        this.cancelPolling();
      } else if (this.wasHidden) {
        this.wasHidden = false;
        this.checkAgain();
      }
    });
    if (this.task) {
      this.reapplySubmissionData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.task) {
      this.cancelPolling();
      this.pollAttempt = 0;
      // Angular invokes the initial ngOnChanges before ngOnInit. Let ngOnInit
      // perform that first authoritative fetch so initial rendering does not
      // issue two concurrent status requests; later task changes refresh here.
      if (this.initialized) {
        this.reapplySubmissionData();
      }
    }
  }

  ngOnDestroy(): void {
    this.cancelPolling();
    this.lifecycleSubscription?.unsubscribe();
  }

  reapplySubmissionData(): void {
    if (!this.task) {
      return;
    }

    this.refreshFailed = false;
    this.task.getSubmissionDetails().subscribe({
      next: () => this.scheduleNextPoll(),
      error: () => {
        this.refreshFailed = true;
        this.pollingPaused = true;
      },
    });
  }

  checkAgain(): void {
    this.cancelPolling();
    this.pollAttempt = 0;
    this.pollingPaused = false;
    this.reapplySubmissionData();
  }

  retryProcessing(): void {
    if (!this.task?.submissionRetryable || this.retryPending) {
      return;
    }

    this.retryPending = true;
    this.task.retrySubmissionProcessing().subscribe({
      next: () => {
        this.retryPending = false;
        this.pollAttempt = 0;
        this.pollingPaused = false;
        this.alerts.success('Submission processing was queued again.');
        this.scheduleNextPoll();
      },
      error: () => {
        this.retryPending = false;
        this.alerts.error('Submission processing could not be retried. Try again later.', 6000);
      },
    });
  }

  uploadAlternateFiles(): void {
    this.task.presentTaskSubmissionModal(this.task.status, true);
  }

  regeneratePdf(): void {
    this.task.recreateSubmissionPdf().subscribe({
      next: (response: {result: string}) => {
        if (response.result === 'false') {
          this.alerts.error('There was an error regenerating the PDF', 6000);
        } else {
          this.task.processingPdf = true;
          this.task.submissionProcessingState = 'queued';
          this.task.submissionRetryable = false;
          this.alerts.success(
            'The PDF was queued for regeneration. Its status will update here.',
            6000,
          );
          this.checkAgain();
        }
      },
      error: (_response: Error) => {
        this.alerts.error('Request failed, cannot recreate PDF at this time.', 6000);
      },
    });
  }

  downloadSubmission(): void {
    this.fileDownloader.downloadFile(this.taskPdfUrl, `${this.task.definition.abbreviation}.pdf`);
  }

  downloadSubmissionFiles(): void {
    this.fileDownloader.downloadFile(this.taskFilesUrl, `${this.task.definition.abbreviation}.zip`);
  }

  private scheduleNextPoll(): void {
    this.cancelPolling();
    if (!this.task?.submissionProcessingActive) {
      this.pollingPaused = false;
      return;
    }

    if (this.pollAttempt >= this.pollDelays.length) {
      this.pollingPaused = true;
      return;
    }

    const delay = this.pollDelays[this.pollAttempt++];
    this.pollTimer = window.setTimeout(() => this.reapplySubmissionData(), delay);
  }

  private cancelPolling(): void {
    if (this.pollTimer !== undefined) {
      window.clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }
}
