import {ChangeDetectionStrategy, Component, Inject, InjectionToken} from '@angular/core';
import {FormControl, FormGroup} from '@angular/forms';
import {MatSlideToggleChange} from '@angular/material/slide-toggle';
import {PeerProgressIndicator} from 'src/app/api/models/peer-progress-indicator';
import {TaskStatus, TaskStatusEnum} from 'src/app/api/models/task-status';
import {TeamsMeetingDraft} from '../../unit-hub/teams-meeting-draft';
import {unitHubDemo} from '../../unit-hub/unit-hub-demo.fixtures';
import {DemoMeetingLinksStore} from '../demo-meeting-links.store';
import {DemoModeStore} from '../demo-mode.store';
import {
  DETAIL_PROTECTED_STATE,
  NORMAL_STATE,
  ROUNDED_90_STATE,
  ROUNDED_110_STATE,
  SUPPRESSED_STATE,
} from '../fixtures/peer-progress-demo.fixtures';
import {DEMO_PUSH_PREVIEW} from '../fixtures/push-preview.fixture';

type PpiPreviewKind = 'full' | 'rounded-90' | 'rounded-110' | 'insufficient' | 'details-protected';

interface PpiPreviewSegment {
  status: TaskStatusEnum;
  label: string;
  color: string;
  percentage: number;
}

export const DEMO_RELOAD: InjectionToken<() => void> = new InjectionToken('DEMO_RELOAD', {
  providedIn: 'root',
  factory: () => () => globalThis.location?.reload(),
});

@Component({
  selector: 'f-demo-controls',
  templateUrl: './demo-controls.component.html',
  styleUrls: ['./demo-controls.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class DemoControlsComponent {
  readonly demoMeetingDraft: TeamsMeetingDraft = {
    ...unitHubDemo().sessions[0],
    title: 'DEMO · HelpHub meeting draft',
    description:
      'Fictional OnTrack demonstration. Review the example date and time before sending any invitation.',
  };
  readonly meetingLinksForm = new FormGroup({
    helpHub: new FormControl('', {nonNullable: true}),
    extraHelpHub: new FormControl('', {nonNullable: true}),
  });
  meetingLinksError = '';
  meetingLinksStatus = '';
  readonly pushPreview = DEMO_PUSH_PREVIEW;
  readonly ppiPreviewOptions: {kind: PpiPreviewKind; label: string}[] = [
    {kind: 'full', label: 'Full status data'},
    {kind: 'rounded-90', label: 'Rounded total 90%'},
    {kind: 'rounded-110', label: 'Rounded total 110%'},
    {kind: 'insufficient', label: 'Insufficient cohort'},
    {kind: 'details-protected', label: 'Advanced details protected'},
  ];

  ppiPreviewKind: PpiPreviewKind = 'full';
  ppiPreviewAdvanced = false;
  private readonly ppiStatusDisplayIndex = new Map(
    TaskStatus.PEER_PROGRESS_DISPLAY_ORDER.map((status, index) => [status, index]),
  );

  readonly affectedSurfaces = [
    'Unit Hub: fictional SIT111 announcements and sessions, with SIT102 excluded and API writes disabled',
    'All live local project cards, tasks, deadline warnings, filters, and recommendation scores',
    'The live notification bell, unread count, and notification history',
    'Live task-level peer comparison data returned by the local API',
    'A privacy-safe lifecycle spread (60% submitted and 10% complete), unit summary, and anonymous burndown sample',
  ];

  constructor(
    readonly demoMode: DemoModeStore,
    @Inject(DEMO_RELOAD) private reload: () => void,
    private meetingLinks: DemoMeetingLinksStore,
  ) {
    this.meetingLinksForm.setValue(this.meetingLinks.links);
  }

  saveMeetingLinks(): void {
    this.meetingLinksError = '';
    this.meetingLinksStatus = '';
    try {
      this.meetingLinks.save(this.meetingLinksForm.getRawValue());
      this.meetingLinksStatus =
        'Saved for this browser tab. Open Unit Hub to use the links in demo mode.';
    } catch (error) {
      this.meetingLinksError =
        error instanceof Error ? error.message : 'The links could not be saved.';
    }
  }

  clearMeetingLinks(): void {
    this.meetingLinks.clear();
    this.meetingLinksForm.reset();
    this.meetingLinksError = '';
    this.meetingLinksStatus = 'Hosted links removed. Sample meetings will be disabled.';
  }

  setDemoMode(change: MatSlideToggleChange): void {
    if (change.checked === this.demoMode.enabled) {
      return;
    }

    this.demoMode.setEnabled(change.checked);
    this.reload();
  }

  setPpiPreview(kind: PpiPreviewKind): void {
    this.ppiPreviewKind = kind;
    this.ppiPreviewAdvanced = false;
  }

  setPpiPreviewAdvanced(advanced: boolean): void {
    this.ppiPreviewAdvanced = advanced;
  }

  get ppiPreview(): PeerProgressIndicator {
    switch (this.ppiPreviewKind) {
      case 'insufficient':
        return SUPPRESSED_STATE;
      case 'details-protected':
        return DETAIL_PROTECTED_STATE;
      case 'rounded-90':
        return ROUNDED_90_STATE;
      case 'rounded-110':
        return ROUNDED_110_STATE;
      default:
        return NORMAL_STATE;
    }
  }

  get ppiPreviewPercentage(): number {
    return this.ppiPreview.completedPercentage ?? this.ppiPreview.submittedPercentage ?? 0;
  }

  get ppiPreviewWidth(): string {
    return `${Math.min(100, Math.max(0, this.ppiPreviewPercentage))}%`;
  }

  get ppiPreviewSegments(): PpiPreviewSegment[] {
    return this.ppiPreview.statusDistribution
      .filter((entry) => entry.percentage > 0)
      .sort(
        (left, right) =>
          (this.ppiStatusDisplayIndex.get(left.status) ?? Number.MAX_SAFE_INTEGER) -
          (this.ppiStatusDisplayIndex.get(right.status) ?? Number.MAX_SAFE_INTEGER),
      )
      .map((entry) => ({
        ...entry,
        label:
          entry.status === 'ready_for_feedback'
            ? 'Ready for Feedback'
            : (TaskStatus.STATUS_LABELS.get(entry.status) ?? entry.status),
        color: TaskStatus.STATUS_COLORS.get(entry.status) ?? '#64748b',
      }));
  }

  get ppiPreviewDistributionTotal(): number {
    return this.ppiPreviewSegments.reduce((total, segment) => total + segment.percentage, 0);
  }

  get ppiPreviewUsesStackedDistribution(): boolean {
    return this.ppiPreviewDistributionTotal === 100;
  }

  formatPpiPercentage(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1).replace(/\.0$/, '');
  }
}
