import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatSlideToggle} from '@angular/material/slide-toggle';
import {Project, ProjectService, Webcal, WebcalService} from 'src/app/api/models/doubtfire-model';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {FileDownloaderService} from '../../file-downloader/file-downloader.service';
import {AlertService} from '../../services/alert.service';
import {ConfirmationModalService} from '../confirmation-modal/confirmation-modal.service';

@Component({
  selector: 'calendar-modal',
  templateUrl: './calendar-modal.component.html',
  styleUrls: ['./calendar-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CalendarModalComponent implements OnInit, AfterViewInit {
  @ViewChild('webcalToggle') webcalToggle: MatSlideToggle;

  webcal: Webcal | null;
  private savedWebcal: Webcal | null = null;
  working: boolean = true;
  copying: boolean = false;
  selectedCalendarProviderIndex: number = 0;
  projects: Project[] = [];

  // Used to store user interaction with the reminder option. These values aren't bound directly to `this.webcal`
  // because they are resettable.
  newReminderActive: boolean = false;
  newReminderTime: number | null = null;
  newReminderUnit: string | null = null;

  constructor(
    private webcalService: WebcalService,
    private constants: DoubtfireConstants,
    private alerts: AlertService,
    private projectService: ProjectService,
    @Inject(MAT_DIALOG_DATA) public data: object,
    private confirmationModal: ConfirmationModalService,
    private fileDownloader: FileDownloaderService,
    readonly demoMode: DemoModeStore,
  ) {}

  ngOnInit() {
    // Retrieve current webcal.
    this.working = true;
    this.webcalService.get({}).subscribe((webcal) => {
      this.loadWebcal(webcal);
      this.working = false;
    });

    // Allow selection of units with active projects.
    this.projectService
      .query(undefined, {params: {include_in_active: false}})
      .subscribe((projects) => {
        this.projects = projects.filter((p) => p.unit.teachingPeriod?.active ?? true);
      });
  }

  ngAfterViewInit() {
    // Disallow the value of the slide toggle being changed by the user. Instead, its value is bound to the presence of
    // `this.webcal`.
    this.webcalToggle.defaults.disableToggleValue = true;
  }

  /**
   * Retrieves the URL of the webcal relative to current API URL.
   */
  get webcalUrl(): string | null {
    return this.webcal?.getUrl(this.constants.API_URL).toString();
  }

  /**
   * The subscription URL exactly as it is shown to the user, with the `.ics`
   * suffix, so the copied string matches what is on screen.
   */
  get webcalSubscriptionUrl(): string | null {
    const url = this.webcalUrl;
    return url ? `${url}.ics` : null;
  }

  /**
   * Invoked when the user toggles the webcal.
   */
  onWebcalToggle() {
    if (this.working) {
      return;
    }
    if (this.webcal.enabled) {
      this.confirmationModal.show(
        'Disable web calendar',
        'Disabling your web calendar will expire the current subscription URL. Any calendar apps using this URL will stop updating, and a new URL will be generated if you enable the calendar again.',
        () => this.updateWebcalEnabled(false),
      );
      return;
    }

    this.updateWebcalEnabled(true);
  }

  private updateWebcalEnabled(enabled: boolean) {
    this.saveWebcal(() => (this.webcal.enabled = enabled));
  }

  /**
   * Saves the webcal, one request at a time. `apply` changes the model and only runs when no
   * save is in flight, because an overlapping save would let the earlier response clear
   * `working` while the later one is still pending, reopening Download a copy too early.
   * Every save in this dialog goes through here, including the ones behind a confirmation.
   * Returns false when a save was already running and nothing changed.
   */
  private saveWebcal(apply: () => void): boolean {
    if (this.working) {
      return false;
    }
    const previous = this.savedWebcal ?? this.copyWebcal(this.webcal);
    apply();
    this.working = true;
    this.webcalService.update(this.webcal).subscribe({
      next: (webcal) => {
        this.loadWebcal(webcal);
        this.working = false;
      },
      error: () => {
        this.loadWebcal(Object.assign(this.webcal, previous));
        this.working = false;
        this.alerts.error('Could not save calendar settings. Please try again.', 4000);
      },
    });
    return true;
  }

  /**
   * Downloads the current web calendar feed as an .ics file. Skipped while a settings update
   * is still saving, the same as every other control in this dialog, so the copy never reflects
   * settings the server has not stored yet or a URL that is being regenerated.
   */
  downloadCalendar() {
    if (this.working || !this.webcal?.enabled || !this.webcal.guid) {
      return;
    }

    const feedUrl = `${this.constants.API_URL}/webcal/${this.webcal.guid}`;
    this.fileDownloader.downloadFile(feedUrl, 'ontrack-calendar.ics');
  }

  /**
   * Invoked by cdkCopyToClipboard once it has attempted the copy. Only
   * confirm on a real success, so a refused clipboard write does not claim
   * the URL was copied. Changes mat-icon temporarily for a second after.
   */
  onCopyResult(success: boolean) {
    if (!success) {
      this.alerts.error('Could not copy the URL, select it and copy it manually', 4000);
      return;
    }

    this.alerts.success('Web calendar URL copied to the clipboard', 2000);
    this.copying = true;

    setTimeout(() => {
      this.copying = false;
    }, 1000);
  }

  /**
   * Invoked when the user requests their webcal URL to be changed.
   */
  onChangeWebcalUrl() {
    if (this.working) {
      return;
    }
    this.confirmationModal.show(
      'Regenerate URL',
      'Regenerating your calendar URL will disable the current subscription link. Any calendar apps using the old URL will stop updating until you subscribe again with the new one.',
      () => this.saveWebcal(() => (this.webcal.shouldChangeGuid = true)),
    );
  }

  /**
   * Invoked when the user toggles the "has reminder" option.
   */
  onToggleReminderActive() {
    // If the option is enabled...
    if (this.newReminderActive) {
      // ...and a reminder doesn't exist already, default it to 1 week, but don't save the value yet.
      if (!this.webcal.reminder) {
        this.newReminderTime = 1;
        this.newReminderUnit = 'W';
      }

      // If the option is disabled...
    } else {
      // ...and a reminder does exist, make backend request to remove it.
      if (this.webcal.reminder) {
        // If a save is already running, put the switch back to match the stored reminder.
        if (!this.saveWebcal(() => (this.webcal.reminder = null))) {
          this.loadWebcal(this.webcal);
        }

        // ...otherwise, reset.
      } else {
        this.loadWebcal(this.webcal);
      }
    }
  }

  /**
   * Invoked when the user saves the edited reminder time & unit.
   */
  onSaveReminderEdits() {
    if (this.newReminderTime > 0) {
      this.saveWebcal(
        () =>
          (this.webcal.reminder = {
            time: this.newReminderTime,
            unit: this.newReminderUnit,
          }),
      );
    } else {
      this.alerts.error('Please specify a valid reminder time', 2000);
    }
  }

  /**
   * Invoked when the user cancels their edits to the reminder option, reverting the webcal to its original state.
   */
  onCancelReminderEdits() {
    this.loadWebcal(this.webcal);
  }

  /**
   * Includes task 'Start Dates' in the Webcal.
   */
  toggleIncludeTaskStartDates() {
    // The checkbox has already changed the model through ngModel, so there is nothing to apply.
    this.saveWebcal(() => undefined);
  }

  toggleIncludeLearningSessions() {
    if (this.demoMode.enabled) {
      if (this.savedWebcal) {
        this.loadWebcal(this.copyWebcal(this.savedWebcal));
      }
      return;
    }
    this.saveWebcal(() => undefined);
  }

  /**
   * Retrieves a list of excluded projects.
   */
  get excludedProjects(): Project[] {
    if (this.webcal.unitExclusions && this.webcal.unitExclusions.length > 0) {
      return this.projects.filter((p) => this.webcal.unitExclusions.indexOf(p.unit.id) !== -1);
    } else {
      return [];
    }
  }

  /**
   * Retrieves a list of included projects.
   */
  get includedProjects(): Project[] {
    if (this.webcal.unitExclusions && this.webcal.unitExclusions.length > 0) {
      return this.projects.filter((p) => this.webcal.unitExclusions.indexOf(p.unit.id) === -1);
    } else {
      return this.projects;
    }
  }

  /**
   * Removes the specified project exclusion from the webcal.
   */
  removeExclusion(project) {
    this.saveWebcal(
      () =>
        (this.webcal.unitExclusions = this.webcal.unitExclusions.filter(
          (p) => p !== project.unit.id,
        )),
    );
  }

  /**
   * Excludes the specified project from the webcal.
   */
  includeExclusion(project) {
    this.saveWebcal(
      () => (this.webcal.unitExclusions = [...this.webcal.unitExclusions, project.unit.id]),
    );
  }

  /**
   * Resets the state of this modal according to match the specified webcal.
   */
  private loadWebcal(webcal: Webcal) {
    this.webcal = webcal;
    this.savedWebcal = webcal ? this.copyWebcal(webcal) : null;
    if (webcal) {
      if (webcal.reminder) {
        this.newReminderActive = true;
        this.newReminderTime = webcal.reminder.time;
        this.newReminderUnit = webcal.reminder.unit;
      } else {
        this.newReminderActive = false;
        this.newReminderTime = this.newReminderUnit = null;
      }
    }
  }

  private copyWebcal(webcal: Webcal): Webcal {
    return Object.assign(new Webcal(), webcal, {
      reminder: webcal.reminder ? {...webcal.reminder} : null,
      unitExclusions: [...(webcal.unitExclusions ?? [])],
      shouldChangeGuid: false,
    });
  }
}
