import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import {Subscription} from 'rxjs';
import {
  PeerProgressViewModel,
  resolvePeerProgressState,
} from 'src/app/api/models/peer-progress-indicator-state';
import {Task} from 'src/app/api/models/task';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {TaskStatus, TaskStatusEnum} from 'src/app/api/models/task-status';
import {PeerProgressIndicatorService} from 'src/app/api/services/peer-progress-indicator.service';

interface PeerProgressDisplaySegment {
  status: TaskStatusEnum;
  label: string;
  color: string;
  percentage: number;
}

// f-ppi-widget: renders the privacy-safe peer progress indicator below a task submission.
@Component({
  selector: 'f-ppi-widget',
  templateUrl: './ppi-widget.component.html',
  styleUrls: ['./ppi-widget.component.scss'],
  standalone: false,
})
export class PpiWidgetComponent implements OnChanges, OnDestroy {
  @Input({required: true}) task: Task;
  @Input({required: true}) taskDef: TaskDefinition;

  view: PeerProgressViewModel = {state: 'loading', data: null, message: null};
  advanced = false;

  private activeRequest?: Subscription;
  private readonly statusDisplayIndex = new Map(
    TaskStatus.PEER_PROGRESS_DISPLAY_ORDER.map((status, index) => [status, index]),
  );

  constructor(
    private ppiService: PeerProgressIndicatorService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.task || changes.taskDef) {
      this.advanced = false;
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.activeRequest?.unsubscribe();
  }

  retry(): void {
    this.load();
  }

  setAdvanced(enabled: boolean): void {
    this.advanced = enabled;
    this.cdr.markForCheck();
  }

  get isCompactResult(): boolean {
    return this.view.state === 'success' || this.view.state === 'no-data';
  }

  get summaryPercentage(): number {
    return this.view.data?.completedPercentage ?? this.view.data?.submittedPercentage ?? 0;
  }

  get summaryVerb(): 'completed' | 'submitted' {
    return this.hasCompletedPercentage ? 'completed' : 'submitted';
  }

  get hasCompletedPercentage(): boolean {
    return (
      this.view.data?.completedPercentage !== null &&
      this.view.data?.completedPercentage !== undefined
    );
  }

  get hasSubmittedPercentage(): boolean {
    return (
      this.view.data?.submittedPercentage !== null &&
      this.view.data?.submittedPercentage !== undefined
    );
  }

  get summaryWidth(): string {
    return `${Math.min(100, Math.max(0, this.summaryPercentage))}%`;
  }

  get displaySegments(): PeerProgressDisplaySegment[] {
    return (this.view.data?.statusDistribution ?? [])
      .filter((entry) => entry.percentage > 0)
      .sort(
        (left, right) =>
          (this.statusDisplayIndex.get(left.status) ?? Number.MAX_SAFE_INTEGER) -
          (this.statusDisplayIndex.get(right.status) ?? Number.MAX_SAFE_INTEGER),
      )
      .map((entry) => ({
        ...entry,
        label: this.statusLabel(entry.status),
        color: TaskStatus.STATUS_COLORS.get(entry.status) ?? '#64748b',
      }));
  }

  get distributionTotal(): number {
    return this.displaySegments.reduce((total, segment) => total + segment.percentage, 0);
  }

  get usesStackedDistribution(): boolean {
    return this.distributionTotal === 100;
  }

  get distributionAriaLabel(): string {
    const detail = this.displaySegments
      .map((segment) => `${segment.label} ${this.formatPercentage(segment.percentage)}%`)
      .join(', ');

    return `Anonymous peer task status distribution: ${detail}`;
  }

  get titleId(): string {
    return `peer-progress-title-${this.taskDef?.id ?? 'loading'}`;
  }

  get advancedPanelId(): string {
    return `peer-progress-advanced-${this.taskDef?.id ?? 'loading'}`;
  }

  get independentScaleNoticeId(): string {
    return `peer-progress-independent-scale-${this.taskDef?.id ?? 'loading'}`;
  }

  get advancedToggleLabel(): string {
    return 'Advanced peer status breakdown';
  }

  get distributionNoticeTitle(): string {
    return this.isDistributionPrivacyProtected
      ? 'Detailed breakdown protected'
      : 'Detailed breakdown not available';
  }

  get distributionNoticeText(): string {
    return this.isDistributionPrivacyProtected
      ? 'This cohort can show an overall percentage, but the status-by-status view is hidden because individual progress could otherwise be inferred.'
      : 'The overall percentage is available, but a privacy-safe status-by-status snapshot has not been prepared yet.';
  }

  formatPercentage(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1).replace(/\.0$/, '');
  }

  private humaniseStatus(status: string): string {
    return status
      .split('_')
      .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(' ');
  }

  private statusLabel(status: TaskStatusEnum): string {
    return status === 'ready_for_feedback'
      ? 'Ready for Feedback'
      : (TaskStatus.STATUS_LABELS.get(status) ?? this.humaniseStatus(status));
  }

  private get isDistributionPrivacyProtected(): boolean {
    const reason = this.view.data?.distributionUnavailableReason;
    return reason === 'privacy_protection' || reason === 'insufficient_cohort';
  }

  private setView(next: PeerProgressViewModel): void {
    this.view = next;
    this.cdr.markForCheck();
  }

  private load(): void {
    if (!this.task?.project || !this.taskDef) {
      return;
    }

    // Cancel the previous request first so a late response cannot replace the
    // loading state for a newly selected task.
    this.activeRequest?.unsubscribe();
    this.setView(resolvePeerProgressState(true, null, null));

    this.activeRequest = this.ppiService
      .getIndicator(this.task.project.id, this.taskDef.id)
      .subscribe({
        next: (data) => this.setView(resolvePeerProgressState(false, null, data)),
        error: (err) => this.setView(resolvePeerProgressState(false, err, null)),
      });
  }
}
