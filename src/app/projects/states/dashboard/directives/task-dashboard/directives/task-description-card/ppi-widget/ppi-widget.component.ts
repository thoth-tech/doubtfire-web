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
import {PeerProgressDisplayPreferenceService} from 'src/app/common/services/peer-progress-display-preference.service';

type PeerProgressHighlightSource = 'pointer' | 'focus';

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

  // The status whose segment is emphasised, and whether a pointer or keyboard
  // focus asked for it. Hover emphasis is only styled on fine-pointer devices.
  highlightedStatus: TaskStatusEnum | null = null;
  highlightSource: PeerProgressHighlightSource | null = null;

  // Bars grow in only the first time a result is shown. Later refreshes change
  // widths in place without replaying the entrance.
  animateEntry = false;

  private hasShownResult = false;
  private activeRequest?: Subscription;
  private readonly statusDisplayIndex = new Map(
    TaskStatus.PEER_PROGRESS_DISPLAY_ORDER.map((status, index) => [status, index]),
  );

  constructor(
    private ppiService: PeerProgressIndicatorService,
    private displayPreference: PeerProgressDisplayPreferenceService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.task || changes.taskDef) {
      this.advanced = this.displayPreference.enabled;
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
    this.advanced = this.displayPreference.setEnabled(enabled);
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
        color: `var(--ot-status-${TaskStatus.statusClass(entry.status)}-graphic, var(--ot-color-text-muted))`,
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

  get highlightedSegment(): PeerProgressDisplaySegment | null {
    if (this.highlightedStatus === null) {
      return null;
    }
    return (
      this.displaySegments.find((segment) => segment.status === this.highlightedStatus) ?? null
    );
  }

  // Rows per legend column, so a two-column legend fills top to bottom in
  // display order instead of leaving a lone item on a final row.
  get legendRows(): number {
    return Math.max(1, Math.ceil(this.displaySegments.length / 2));
  }

  get breakdownHeadingId(): string {
    return `peer-progress-breakdown-${this.taskDef?.id ?? 'loading'}`;
  }

  highlight(status: TaskStatusEnum, source: PeerProgressHighlightSource): void {
    this.highlightedStatus = status;
    this.highlightSource = source;
    this.cdr.markForCheck();
  }

  clearHighlight(source: PeerProgressHighlightSource): void {
    if (this.highlightSource !== source) {
      return;
    }
    this.highlightedStatus = null;
    this.highlightSource = null;
    this.cdr.markForCheck();
  }

  // Horizontal centre of a segment in the stacked bar, used to place its tooltip.
  segmentMidpoint(status: TaskStatusEnum): string {
    const segments = this.displaySegments;
    const total = this.distributionTotal || 1;
    let offset = 0;

    for (const segment of segments) {
      if (segment.status === status) {
        return `${((offset + segment.percentage / 2) / total) * 100}%`;
      }
      offset += segment.percentage;
    }
    return '50%';
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
    this.highlightedStatus = null;
    this.highlightSource = null;

    if (next.state === 'success' || next.state === 'no-data') {
      this.animateEntry = !this.hasShownResult;
      this.hasShownResult = true;
    }
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
