import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {PeerProgressUnitSummaryViewModel} from 'src/app/api/models/peer-progress-unit-summary-state';

@Component({
  selector: 'f-peer-progress-unit-summary',
  templateUrl: './peer-progress-unit-summary.component.html',
  styleUrls: ['./peer-progress-unit-summary.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PeerProgressUnitSummaryComponent {
  @Input({required: true}) view: PeerProgressUnitSummaryViewModel = {
    state: 'loading',
    data: null,
    message: null,
  };

  get studentPercentage(): number | null {
    return this.view.data?.studentPercentage ?? null;
  }

  get cohortPercentage(): number | null {
    return this.view.data?.submittedPercentage ?? null;
  }

  get canShowCohortPercentage(): boolean {
    return (
      (this.view.state === 'success' || this.view.state === 'no-data') &&
      this.cohortPercentage !== null
    );
  }

  get cohortStateIcon(): string {
    switch (this.view.state) {
      case 'hidden':
        return 'visibility_off';
      case 'stale':
        return 'history';
      default:
        return 'info';
    }
  }
}
