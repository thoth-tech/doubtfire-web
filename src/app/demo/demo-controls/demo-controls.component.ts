import {ChangeDetectionStrategy, Component} from '@angular/core';
import {FormControl, FormGroup} from '@angular/forms';
import {MatSlideToggleChange} from '@angular/material/slide-toggle';
import {TeamsMeetingDraft} from '../../unit-hub/teams-meeting-draft';
import {unitHubDemo} from '../../unit-hub/unit-hub-demo.fixtures';
import {DemoMeetingLinksStore} from '../demo-meeting-links.store';
import {DemoModeStore} from '../demo-mode.store';
import {DemoScenarioRegistryService} from '../demo-scenario-registry.service';
import {DEMO_PUSH_PREVIEW} from '../fixtures/push-preview.fixture';

@Component({
  selector: 'f-demo-controls',
  templateUrl: './demo-controls.component.html',
  styleUrls: ['./demo-controls.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class DemoControlsComponent {
  readonly scenario$ = this.registry.scenario$;

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

  constructor(
    readonly demoMode: DemoModeStore,
    readonly registry: DemoScenarioRegistryService,
    private meetingLinks: DemoMeetingLinksStore,
  ) {
    this.meetingLinksForm.setValue(this.meetingLinks.links);
  }

  setDemoMode(change: MatSlideToggleChange): void {
    this.demoMode.setEnabled(change.checked);
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

  statusLabel(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
