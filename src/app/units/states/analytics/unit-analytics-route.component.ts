import {formatDate} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  Input,
  LOCALE_ID,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable, Subscription, catchError, distinctUntilChanged, forkJoin, of} from 'rxjs';
import {SidekiqJob} from 'src/app/api/models/sidekiq-job';
import {Unit} from 'src/app/api/models/unit';
import {
  TargetGradeStat,
  TaskCompletionStats,
  TaskStatusStats,
  UnitService,
} from 'src/app/api/services/unit.service';
import {UserService} from 'src/app/api/services/user.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {SidekiqProgressModalService} from 'src/app/common/modals/sidekiq-progress-modal/sidekiq-progress-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';

export type AnalyticsReportId =
  | 'taskCompletion'
  | 'taskAssessmentCounts'
  | 'tasksAwaitingFeedback'
  | 'tutorAssessments'
  | 'overflowTaskClaims';

export interface AnalyticsReport {
  id: AnalyticsReportId;
  title: string;
  description: string;
  /** Only convenors and admins can download it. The API refuses anyone else. */
  convenorOnly?: boolean;
}

export interface AnalyticsReportGroup {
  id: string;
  title: string;
  reports: readonly AnalyticsReport[];
}

// The descriptions say what is in each file, taken from the columns the API writes,
// so staff can pick the right one without opening all five.
export const ANALYTICS_REPORT_GROUPS: readonly AnalyticsReportGroup[] = [
  {
    id: 'students',
    title: 'Students and tasks',
    reports: [
      {
        id: 'taskCompletion',
        title: 'Task completion',
        description:
          "Each student's status on every task, with their tutorial, target grade and portfolio grade.",
      },
      {
        id: 'taskAssessmentCounts',
        title: 'Task assessment counts',
        description:
          "How many times each student's task was given each status, such as complete, fix and resubmit or redo.",
      },
    ],
  },
  {
    id: 'marking',
    title: 'Marking and feedback',
    reports: [
      {
        id: 'tasksAwaitingFeedback',
        title: 'Tasks awaiting feedback',
        description:
          'Every task waiting for feedback, with its tutorial, tutor and how many days it has waited.',
      },
      {
        id: 'tutorAssessments',
        title: 'Tutor assessments',
        description: "For each tutor, how many times their students' tasks have been assessed.",
      },
      {
        id: 'overflowTaskClaims',
        title: 'Overflow task claims',
        description:
          "Tasks a tutor claimed from another tutor's queue, with how long each had waited.",
        convenorOnly: true,
      },
    ],
  },
];

@Component({
  selector: 'f-unit-analytics',
  templateUrl: 'unit-analytics-route.component.html',
  styleUrls: ['unit-analytics-route.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class UnitAnalyticsComponent implements OnInit, OnDestroy {
  @Input() public unit$: Observable<Unit>;

  public unit: Unit;

  public readonly reportGroups = ANALYTICS_REPORT_GROUPS;

  public tutorialId: number | null = null;
  public taskStatusStats: TaskStatusStats | null = null;
  public targetGradeStats: TargetGradeStat[] | null = null;
  public taskCompletionStats: TaskCompletionStats | null = null;
  public statisticsLoading = false;
  public statisticsFailed = false;
  private statisticsSub?: Subscription;
  private unitSub?: Subscription;

  constructor(
    private sidekiqProgressModalService: SidekiqProgressModalService,
    private alertService: AlertService,
    private fileDownloaderService: FileDownloaderService,
    private userService: UserService,
    private route: ActivatedRoute,
    private unitService: UnitService,
    @Inject(LOCALE_ID) private locale: string,
  ) {}

  ngOnInit(): void {
    this.unit$ = this.unit$ ?? of(this.route.parent?.snapshot?.data?.unit);
    this.unitSub = this.unit$
      ?.pipe(distinctUntilChanged((a, b) => a?.id === b?.id))
      .subscribe((unit) => {
        this.unit = unit;
        this.tutorialId = null;
        this.loadStatistics();
      });
  }

  ngOnDestroy(): void {
    this.unitSub?.unsubscribe();
    this.statisticsSub?.unsubscribe();
  }

  public loadStatistics(): void {
    this.statisticsSub?.unsubscribe();
    this.taskStatusStats = null;
    this.targetGradeStats = null;
    this.taskCompletionStats = null;
    this.statisticsFailed = false;
    this.statisticsLoading = !!this.unit;
    if (!this.unit) {
      return;
    }
    this.statisticsSub = forkJoin({
      statuses: this.unitService
        .taskStatusCountByTutorial(this.unit)
        .pipe(catchError(() => of(null))),
      grades: this.unitService.targetGradeStats(this.unit).pipe(catchError(() => of(null))),
      completion: this.unitService.taskCompletionStats(this.unit).pipe(catchError(() => of(null))),
    }).subscribe(({statuses, grades, completion}) => {
      this.taskStatusStats = statuses;
      this.targetGradeStats = grades;
      this.taskCompletionStats = completion;
      this.statisticsFailed = statuses === null || grades === null || completion === null;
      this.statisticsLoading = false;
    });
  }

  get role() {
    return this.unit?.staff?.find((s) => s.user?.id === this.userService.currentUser?.id)?.role;
  }

  get isAdmin() {
    return this.userService.currentUser?.systemRole === 'Admin';
  }

  public canDownload(report: AnalyticsReport): boolean {
    return !report.convenorOnly || this.role === 'Convenor' || this.isAdmin;
  }

  public downloadReport(report: AnalyticsReport): void {
    switch (report.id) {
      case 'taskCompletion':
        return this.getTaskCompletionCsv();
      case 'taskAssessmentCounts':
        return this.getTaskAssessmentCountCsv();
      case 'tasksAwaitingFeedback':
        return this.getTasksAwaitingFeedbackCsv();
      case 'tutorAssessments':
        return this.getTutorAssessmentCsv();
      case 'overflowTaskClaims':
        return this.getOverflowTaskClaimsCsv();
    }
  }

  public getTaskCompletionCsv() {
    this.downloadCsv(
      this.unit.downloadTaskCompletionCsv(),
      'task completion CSV',
      `${this.unit.code}-task-completion-stats.csv`,
    );
  }

  public getTutorAssessmentCsv() {
    this.downloadCsv(
      this.unit.downloadTutorAssessmentCsv(),
      'tutor assessments CSV',
      `${this.unit.code}-tutor-assessment-stats.csv`,
    );
  }

  public getTasksAwaitingFeedbackCsv() {
    this.downloadCsv(
      this.unit.downloadTasksAwaitingFeedbackCsv(),
      'tasks awaiting feedback CSV',
      `${this.unit.code}-tasks-awaiting-feedback.csv`,
    );
  }

  public getTaskAssessmentCountCsv() {
    this.downloadCsv(
      this.unit.downloadTaskAssessmentCountsCsv(),
      'task assessment counts CSV',
      `${this.unit.code}-task-assessment-counts.csv`,
    );
  }

  public getOverflowTaskClaimsCsv() {
    const timestamp = formatDate(new Date(), 'd-MMMM-y-HHmm', this.locale).toLowerCase();

    this.downloadCsv(
      this.unit.downloadOverflowTaskClaimsCsv(),
      'overflow task claims CSV',
      `${this.unit.code}-overflow-task-claims-${timestamp}.csv`,
    );
  }

  // An arrow function, not a method, because the tutor times card calls it through its
  // downloadCsvFn input. A method passed that way ran with the card as `this`, which has
  // no alertsService, so a failed download threw instead of showing the alert.
  public readonly downloadCsv = (
    newJob: Observable<SidekiqJob>,
    title: string,
    filename: string,
  ): void => {
    newJob.subscribe({
      next: (job) => {
        if (!job?.id) {
          this.alertService.error(`Failed to download ${title}`, 6000);
          return;
        }
        this.sidekiqProgressModalService.show(`Downloading ${title}`, job.id).subscribe((done) => {
          const blob = new Blob([done.result], {type: 'text/csv'});
          const url = URL.createObjectURL(blob);

          this.fileDownloaderService.downloadBlobToFile(url, filename);
          // Give the browser time to start the download, then free the file's memory.
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        });
      },
      error: (error) => {
        this.alertService.error(`Could not download ${title}: ${error}`, 6000);
      },
    });
  };
}
