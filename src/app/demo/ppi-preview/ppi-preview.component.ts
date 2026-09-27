import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, ChangeDetectorRef, Component} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {PeerProgressIndicator} from 'src/app/api/models/peer-progress-indicator';
import {TaskStatus, TaskStatusEnum} from 'src/app/api/models/task-status';
import {PeerProgressDisplayPreferenceService} from 'src/app/common/services/peer-progress-display-preference.service';
import {
  DETAIL_PROTECTED_STATE,
  NORMAL_STATE,
  ROUNDED_90_STATE,
  ROUNDED_110_STATE,
  SUPPRESSED_STATE,
} from '../fixtures/peer-progress-demo.fixtures';

type PpiPreviewKind = 'full' | 'rounded-90' | 'rounded-110' | 'insufficient' | 'details-protected';

interface PpiPreviewOption {
  kind: PpiPreviewKind;
  label: string;
  explanation: string;
  data: PeerProgressIndicator;
}

interface PpiPreviewSegment {
  status: TaskStatusEnum;
  label: string;
  color: string;
  percentage: number;
}

@Component({
  selector: 'f-ppi-preview',
  templateUrl: './ppi-preview.component.html',
  styleUrls: ['./ppi-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  standalone: true,
})
export class PpiPreviewComponent {
  readonly options: readonly PpiPreviewOption[] = [
    {
      kind: 'full',
      label: 'Full status data',
      explanation: '60% submitted, 10% complete; seven canonical lifecycle statuses total 100%.',
      data: NORMAL_STATE,
    },
    {
      kind: 'rounded-90',
      label: 'Rounded total 90%',
      explanation:
        'Independent privacy rounding gives 50% submitted and 20% complete; status rows total 90%.',
      data: ROUNDED_90_STATE,
    },
    {
      kind: 'rounded-110',
      label: 'Rounded total 110%',
      explanation:
        'Independent privacy rounding gives 80% submitted and 30% complete; status rows total 110%.',
      data: ROUNDED_110_STATE,
    },
    {
      kind: 'insufficient',
      label: 'Insufficient cohort',
      explanation: 'No peer percentage or detailed status is exposed below the privacy threshold.',
      data: SUPPRESSED_STATE,
    },
    {
      kind: 'details-protected',
      label: 'Advanced details protected',
      explanation:
        'The safe 70% submitted and 30% complete summary remains visible; detailed statuses stay hidden.',
      data: DETAIL_PROTECTED_STATE,
    },
  ];

  selectedKind: PpiPreviewKind = 'full';
  advanced = this.displayPreference.enabled;

  private readonly statusDisplayIndex = new Map(
    TaskStatus.PEER_PROGRESS_DISPLAY_ORDER.map((status, index) => [status, index]),
  );

  constructor(
    private readonly displayPreference: PeerProgressDisplayPreferenceService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  select(kind: PpiPreviewKind): void {
    this.selectedKind = kind;
    this.cdr.markForCheck();
  }

  setAdvanced(enabled: boolean): void {
    this.advanced = this.displayPreference.setEnabled(enabled);
    this.cdr.markForCheck();
  }

  get selected(): PpiPreviewOption {
    return this.options.find((option) => option.kind === this.selectedKind) ?? this.options[0];
  }

  get data(): PeerProgressIndicator {
    return this.selected.data;
  }

  get summaryPercentage(): number {
    return this.data.completedPercentage ?? this.data.submittedPercentage ?? 0;
  }

  get summaryWidth(): string {
    return `${Math.min(100, Math.max(0, this.summaryPercentage))}%`;
  }

  get segments(): PpiPreviewSegment[] {
    return this.data.statusDistribution
      .filter((entry) => entry.percentage > 0)
      .sort(
        (left, right) =>
          (this.statusDisplayIndex.get(left.status) ?? Number.MAX_SAFE_INTEGER) -
          (this.statusDisplayIndex.get(right.status) ?? Number.MAX_SAFE_INTEGER),
      )
      .map((entry) => ({
        ...entry,
        label:
          entry.status === 'ready_for_feedback'
            ? 'Ready for Feedback'
            : (TaskStatus.STATUS_LABELS.get(entry.status) ?? entry.status),
        // The status mark tokens, as the live widget uses, so bars clear 3:1 in dark too.
        color: `var(--ot-status-${TaskStatus.statusClass(entry.status)}-graphic, var(--ot-color-text-muted))`,
      }));
  }

  get distributionTotal(): number {
    return this.segments.reduce((total, segment) => total + segment.percentage, 0);
  }
}
