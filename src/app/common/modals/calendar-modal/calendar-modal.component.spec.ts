import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CdkCopyToClipboard, Clipboard, ClipboardModule} from '@angular/cdk/clipboard';
import {CommonModule} from '@angular/common';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatChipsModule} from '@angular/material/chips';
import {MAT_DIALOG_DATA, MatDialogModule} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatMenuModule} from '@angular/material/menu';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSelectModule} from '@angular/material/select';
import {
  MAT_SLIDE_TOGGLE_DEFAULT_OPTIONS,
  MatSlideToggle,
  MatSlideToggleModule,
} from '@angular/material/slide-toggle';
import {MatTabsModule} from '@angular/material/tabs';
import {MatTooltipModule} from '@angular/material/tooltip';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Subject, of, throwError} from 'rxjs';
import {Project, Webcal} from 'src/app/api/models/doubtfire-model';
import {ProjectService} from 'src/app/api/services/project.service';
import {WebcalService} from 'src/app/api/services/webcal.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {DEMO_TOOLS_AVAILABLE} from 'src/app/demo/demo-mode.store';
import {AlertService} from '../../services/alert.service';
import {ConfirmationModalService} from '../confirmation-modal/confirmation-modal.service';
import {CalendarModalComponent} from './calendar-modal.component';

function buildWebcal(): Webcal {
  const webcal = new Webcal();
  webcal.enabled = true;
  webcal.guid = 'calendar-guid';
  webcal.includeStartDates = false;
  webcal.reminder = {time: 1, unit: 'W'};
  webcal.unitExclusions = [];
  return webcal;
}

function buildProject(id: number, code: string, name: string): Project {
  return {
    id,
    unit: {
      id,
      code,
      name,
      teachingPeriod: {active: true},
    },
  } as Project;
}

describe('CalendarModalComponent', () => {
  let fixture: ComponentFixture<CalendarModalComponent>;
  let component: CalendarModalComponent;
  let webcalService: {
    get: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let projectService: {query: ReturnType<typeof vi.fn>};
  let fileDownloader: {downloadFileWithFeedback: ReturnType<typeof vi.fn>};

  beforeEach(async () => {
    webcalService = {
      get: vi.fn(() => of(buildWebcal())),
      update: vi.fn((webcal: Webcal) => of(webcal)),
    };
    projectService = {
      query: vi.fn(() =>
        of([
          buildProject(1, 'COS10001', 'Introduction to Programming'),
          buildProject(2, 'COS20007', 'Object Oriented Programming'),
        ]),
      ),
    };
    fileDownloader = {downloadFileWithFeedback: vi.fn()};

    await TestBed.configureTestingModule({
      declarations: [CalendarModalComponent],
      imports: [
        ClipboardModule,
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatCardModule,
        MatCheckboxModule,
        MatChipsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatMenuModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatTabsModule,
        MatTooltipModule,
        NoopAnimationsModule,
      ],
      providers: [
        {provide: DEMO_TOOLS_AVAILABLE, useValue: true},
        {provide: MAT_DIALOG_DATA, useValue: {}},
        {provide: WebcalService, useValue: webcalService},
        {provide: ProjectService, useValue: projectService},
        {provide: FileDownloaderService, useValue: fileDownloader},
        {provide: DoubtfireConstants, useValue: {API_URL: 'https://api.example.test/api'}},
        {provide: AlertService, useValue: {success: vi.fn(), error: vi.fn()}},
        {provide: ConfirmationModalService, useValue: {show: vi.fn()}},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarModalComponent);
    component = fixture.componentInstance;
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders wrapped unit controls and one grammatical reminder group', async () => {
    await render();

    const chips: HTMLElement = fixture.nativeElement.querySelector('.calendar-unit-chips');
    const reminder: HTMLElement = fixture.nativeElement.querySelector('.calendar-reminder-group');
    const reminderText = reminder.textContent.replace(/\s+/g, ' ').trim();

    expect(chips.textContent).toContain('COS10001 Introduction to Programming');
    expect(chips.textContent).toContain('COS20007 Object Oriented Programming');
    expect(reminder.querySelector('legend')?.textContent).toContain('Event reminder');
    expect(reminderText).toMatch(/Remind me.*Amount.*Time unit.*before each event\./);
    expect(reminder.querySelector('input[aria-label="Reminder amount"]')).not.toBeNull();
    expect(reminder.querySelector('[aria-label="Reminder time unit"]')).not.toBeNull();
  });

  it('keeps all provider tabs visible and switches to provider-specific instructions', async () => {
    await render();

    const host: HTMLElement = fixture.nativeElement;
    const tabLabels = Array.from(host.querySelectorAll<HTMLElement>('.mat-mdc-tab')).map((tab) =>
      tab.textContent.trim(),
    );

    expect(tabLabels).toEqual(['Google', 'Apple', 'Outlook']);

    component.selectedCalendarProviderIndex = 2;
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.calendar-provider-help__instructions').textContent,
    ).toContain('Subscribe from web');
  });

  it('keeps learning sessions opt-in and restores the saved preference after a failed update', async () => {
    await render();
    expect(component.webcal.includeLearningSessions).toBe(false);
    const response: Subject<Webcal> = new Subject();
    webcalService.update.mockReturnValue(response);

    component.webcal.includeLearningSessions = true;
    component.toggleIncludeLearningSessions();

    expect(webcalService.update).toHaveBeenCalledWith(
      expect.objectContaining({includeLearningSessions: true}),
    );
    expect(component.working).toBe(true);
    response.error(new Error('offline'));
    expect(component.webcal.includeLearningSessions).toBe(false);
    expect(component.working).toBe(false);
  });

  it('blocks the session subscription preference in demo mode', async () => {
    await render();
    component.demoMode.configureScenario('calendar-spec', 1);
    component.demoMode.setEnabled(true);
    webcalService.update.mockClear();

    component.webcal.includeLearningSessions = true;
    component.toggleIncludeLearningSessions();
    fixture.detectChanges();

    expect(webcalService.update).not.toHaveBeenCalled();
    expect(component.webcal.includeLearningSessions).toBe(false);
    expect(fixture.nativeElement.querySelector('#calendar-sessions-hint').textContent).toContain(
      'turned off in demo mode',
    );
    component.demoMode.clearScenario();
  });

  it('uses the shared download feedback helper with a useful ICS filename', async () => {
    await render();

    component.downloadCalendar();

    expect(fileDownloader.downloadFileWithFeedback).toHaveBeenCalledWith(
      'https://api.example.test/api/webcal/calendar-guid',
      'ontrack-calendar.ics',
      {requestKey: 'web-calendar-ics'},
    );
  });

  it('does not start an ICS download before a calendar URL exists', () => {
    component.webcal = null;

    component.downloadCalendar();

    expect(fileDownloader.downloadFileWithFeedback).not.toHaveBeenCalled();
  });

  it('finishes a failed initial load with a retry action instead of a permanent spinner', async () => {
    webcalService.get.mockReturnValue(throwError(() => new Error('offline')));

    await render();

    expect(component.working).toBe(false);
    expect(component.loadError).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Calendar settings could not be loaded',
    );
    expect(
      fixture.nativeElement.querySelector('.calendar-dialog__error button').textContent,
    ).toContain('Retry');
  });

  it('gives a newly-enabled reminder complete default values before saving', async () => {
    const webcal = buildWebcal();
    webcal.reminder = null;
    webcalService.get.mockReturnValue(of(webcal));
    await render();

    component.newReminderActive = true;
    component.onToggleReminderActive();

    expect(component.newReminderTime).toBe(1);
    expect(component.newReminderUnit).toBe('W');
  });

  it('keeps its switch from flipping itself without changing other slide toggles', async () => {
    await render();

    const webcalSwitch = fixture.debugElement.query(By.directive(MatSlideToggle))
      .componentInstance as MatSlideToggle;
    expect(webcalSwitch.defaults.disableToggleValue).toBe(true);
    expect(TestBed.inject(MAT_SLIDE_TOGGLE_DEFAULT_OPTIONS).disableToggleValue).not.toBe(true);
  });
});

const emptyProvider = {};

describe('CalendarModalComponent save and download guards', () => {
  let component: CalendarModalComponent;
  let fixture: ComponentFixture<CalendarModalComponent>;
  let fileDownloaderStub: {downloadFileWithFeedback: ReturnType<typeof vi.fn>};

  beforeEach(async () => {
    fileDownloaderStub = {downloadFileWithFeedback: vi.fn()};

    await TestBed.configureTestingModule({
      declarations: [CalendarModalComponent],
      providers: [
        {provide: DEMO_TOOLS_AVAILABLE, useValue: true},
        {provide: WebcalService, useValue: emptyProvider},
        {provide: DoubtfireConstants, useValue: {API_URL: 'https://doubtfire.test/api'}},
        {provide: AlertService, useValue: emptyProvider},
        {provide: ProjectService, useValue: emptyProvider},
        {provide: MAT_DIALOG_DATA, useValue: emptyProvider},
        {provide: ConfirmationModalService, useValue: emptyProvider},
        {provide: FileDownloaderService, useValue: fileDownloaderStub},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(CalendarModalComponent, {set: {template: ''}})
      .compileComponents();

    fixture = TestBed.createComponent(CalendarModalComponent);
    component = fixture.componentInstance;
    // The dialog opens in its loading state. These tests start after the webcal has loaded.
    component.working = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores saved settings and allows a retry after a failed save', () => {
    const first: Subject<Webcal> = new Subject();
    const retry: Subject<Webcal> = new Subject();
    const update = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(retry);
    const error = vi.fn();
    const internals = component as unknown as {
      webcalService: {update: typeof update};
      alerts: {error: typeof error};
      loadWebcal: (value: Webcal) => void;
    };
    internals.webcalService = {update};
    internals.alerts = {error};
    const webcal = Object.assign(new Webcal(), {
      enabled: true,
      guid: 'saved-guid',
      unitExclusions: [],
      includeStartDates: false,
    });
    internals.loadWebcal(webcal);

    component.includeExclusion({unit: {id: 7}});
    first.error(new Error('offline'));

    expect(component.working).toBe(false);
    expect(component.webcal.unitExclusions).toEqual([]);
    expect(error).toHaveBeenCalledOnce();
    component.includeExclusion({unit: {id: 7}});
    expect(update).toHaveBeenCalledTimes(2);
    expect(component.working).toBe(true);
  });

  it('does not download when the webcal is disabled', () => {
    const webcal = new Webcal();
    webcal.enabled = false;
    webcal.guid = 'abc-123';
    component.webcal = webcal;

    component.downloadCalendar();

    expect(fileDownloaderStub.downloadFileWithFeedback).not.toHaveBeenCalled();
  });

  it('does not download when the webcal is enabled but has no guid', () => {
    const webcal = new Webcal();
    webcal.enabled = true;
    webcal.guid = undefined;
    component.webcal = webcal;

    component.downloadCalendar();

    expect(fileDownloaderStub.downloadFileWithFeedback).not.toHaveBeenCalled();
  });

  it('refuses every other save while one is in flight and holds the download until it lands', () => {
    // Each request gets its own pending response, so resolving the first cannot hide a second.
    const pending: Subject<Webcal>[] = [];
    const update = vi.fn(() => {
      const response: Subject<Webcal> = new Subject();
      pending.push(response);
      return response.asObservable();
    });
    const internals = component as unknown as {
      webcalService: {update: typeof update};
      confirmationModal: {show: (title: string, message: string, confirm: () => void) => void};
    };
    internals.webcalService = {update};
    // Hold on to each confirmation, so it can be confirmed later, while a save is running.
    const confirmations: (() => void)[] = [];
    internals.confirmationModal = {
      show: (_title, _message, confirm) => confirmations.push(confirm),
    };

    const webcal = new Webcal();
    webcal.enabled = true;
    webcal.guid = 'abc-123';
    webcal.unitExclusions = [];
    webcal.reminder = {time: 1, unit: 'W'};
    component.webcal = webcal;
    component.newReminderActive = true;
    component.newReminderTime = 1;
    component.newReminderUnit = 'W';

    // Open both confirmations before any save starts.
    component.onChangeWebcalUrl();
    component.onWebcalToggle();
    expect(confirmations).toHaveLength(2);

    component.includeExclusion({unit: {id: 1}});

    // Every save entry point while the first save is pending.
    component.includeExclusion({unit: {id: 2}});
    component.removeExclusion({unit: {id: 1}});
    component.toggleIncludeTaskStartDates();
    component.newReminderTime = 3;
    component.newReminderUnit = 'D';
    component.onSaveReminderEdits();
    component.newReminderActive = false;
    component.onToggleReminderActive();
    // Confirming the regenerate and disable dialogs now must not start a save either.
    confirmations.forEach((confirm) => confirm());
    component.downloadCalendar();

    expect(update).toHaveBeenCalledOnce();
    expect(webcal.unitExclusions).toEqual([1]);
    expect(webcal.reminder).toEqual({time: 1, unit: 'W'});
    expect(webcal.shouldChangeGuid).toBeFalsy();
    expect(webcal.enabled).toBe(true);
    // The refused reminder switch goes back to match the stored reminder.
    expect(component.newReminderActive).toBe(true);
    expect(component.newReminderTime).toBe(1);
    expect(component.newReminderUnit).toBe('W');
    expect(fileDownloaderStub.downloadFileWithFeedback).not.toHaveBeenCalled();

    pending[0].next(webcal);
    component.downloadCalendar();

    expect(component.working).toBe(false);
    expect(fileDownloaderStub.downloadFileWithFeedback).toHaveBeenCalledOnce();
  });

  it('does not download while a settings update is still saving', () => {
    const webcal = new Webcal();
    webcal.enabled = true;
    webcal.guid = 'abc-123';
    component.webcal = webcal;
    component.working = true;

    component.downloadCalendar();

    expect(fileDownloaderStub.downloadFileWithFeedback).not.toHaveBeenCalled();
  });
});

describe('CalendarModalComponent accessible URL controls', () => {
  let fixture: ComponentFixture<CalendarModalComponent>;
  let clipboard: {copy: ReturnType<typeof vi.fn>};
  let alerts: {success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>};

  beforeEach(async () => {
    clipboard = {copy: vi.fn().mockReturnValue(true)};
    alerts = {success: vi.fn(), error: vi.fn()};
    const webcal = Object.assign(new Webcal(), {
      enabled: true,
      guid: 'synthetic-calendar',
      reminder: null,
      unitExclusions: [],
    });
    await TestBed.configureTestingModule({
      declarations: [CalendarModalComponent],
      imports: [
        ClipboardModule,
        MatIconModule,
        MatSlideToggleModule,
        MatChipsModule,
        MatMenuModule,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {provide: MAT_DIALOG_DATA, useValue: {}},
        {provide: WebcalService, useValue: {get: () => of(webcal)}},
        {provide: ProjectService, useValue: {query: () => of([])}},
        {provide: DoubtfireConstants, useValue: {API_URL: 'https://example.test/api'}},
        {provide: AlertService, useValue: alerts},
        {provide: Clipboard, useValue: clipboard},
        {provide: ConfirmationModalService, useValue: {}},
        {provide: FileDownloaderService, useValue: {}},
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarModalComponent);
    fixture.detectChanges();
  });

  it('renders a named subscription link with the complete ICS URL', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      'a[aria-label^="Subscribe"]',
    );
    expect(link.href).toBe('https://example.test/api/webcal/synthetic-calendar.ics');
    expect(link.getAttribute('aria-label')).toContain(link.href);
    expect(link.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('copies the complete subscription URL from only the separate copy button', () => {
    vi.useFakeTimers();
    try {
      const copyControls = fixture.debugElement.queryAll(By.directive(CdkCopyToClipboard));
      expect(copyControls).toHaveLength(1);
      const copy = copyControls[0].nativeElement as HTMLButtonElement;
      expect(copy.tagName).toBe('BUTTON');
      expect(copy.getAttribute('aria-label')).toBe('Copy web calendar URL');

      copy.click();

      expect(clipboard.copy).toHaveBeenCalledExactlyOnceWith(
        'https://example.test/api/webcal/synthetic-calendar.ics',
      );
      expect(alerts.success).toHaveBeenCalledOnce();
      expect(alerts.error).not.toHaveBeenCalled();
      expect(fixture.componentInstance.copying).toBe(true);
      vi.runAllTimers();
      expect(fixture.componentInstance.copying).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a refused clipboard write without claiming the URL was copied', () => {
    clipboard.copy.mockReturnValue(false);
    const copy: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Copy web calendar URL"]',
    );

    copy.click();

    expect(clipboard.copy).toHaveBeenCalledExactlyOnceWith(
      'https://example.test/api/webcal/synthetic-calendar.ics',
    );
    expect(alerts.success).not.toHaveBeenCalled();
    expect(alerts.error).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.copying).toBe(false);
  });

  it('gives the adjacent copy and regenerate buttons separate accessible names', () => {
    const root: HTMLElement = fixture.nativeElement;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
    const copy = buttons.find((button) => button.textContent?.includes('Copy URL'))!;
    const regenerate = buttons.find((button) => button.textContent?.includes('Regenerate URL'))!;
    expect(copy.getAttribute('aria-label')).toBe('Copy web calendar URL');
    expect(regenerate.getAttribute('aria-label')).toBe('Regenerate web calendar URL');
    expect(copy.disabled).toBe(false);
    expect(regenerate.disabled).toBe(false);
    expect(
      copy.compareDocumentPosition(regenerate) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('names the enable switch and reminder controls', () => {
    fixture.componentInstance.newReminderActive = true;
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const toggle = root.querySelector('mat-slide-toggle button[role="switch"]');
    expect(toggle?.getAttribute('aria-label')).toBe('Enable web calendar');
    // The reminder actions are text buttons, so their visible text is their name.
    const labels = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).map((button) =>
      button.textContent?.trim(),
    );
    expect(labels).toContain('Save reminder');
    expect(labels).toContain('Cancel changes');
  });

  it('uses named native buttons to exclude a unit and open the add-unit menu', () => {
    fixture.componentInstance.projects = [
      {id: 1, unit: {id: 1, code: 'TEST101', name: 'Test unit'}},
      {id: 2, unit: {id: 2, code: 'TEST202', name: 'Other unit'}},
    ] as Project[];
    fixture.componentInstance.webcal.unitExclusions = [2];
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const remove = root.querySelector<HTMLButtonElement>(
      'button[aria-label="Exclude TEST101 from web calendar"]',
    )!;
    const exclude = vi
      .spyOn(fixture.componentInstance, 'includeExclusion')
      .mockImplementation(() => undefined);
    expect(remove.disabled).toBe(false);
    expect(remove.tabIndex).toBe(0);
    remove.click();
    expect(exclude).toHaveBeenCalledWith(fixture.componentInstance.projects[0]);
    remove.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', keyCode: 13, bubbles: true}));
    remove.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', keyCode: 32, bubbles: true}));
    expect(exclude).toHaveBeenCalledTimes(3);
    const add = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Add unit'),
    )!;
    expect(add.getAttribute('aria-haspopup')).toBe('menu');
    fixture.componentInstance.working = true;
    fixture.detectChanges();
    expect(remove.disabled).toBe(true);
    expect(add.disabled).toBe(true);
  });

  it('disables the download a copy button while a settings update is saving', () => {
    const root: HTMLElement = fixture.nativeElement;
    const download = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Download .ics'),
    )!;
    expect(download.disabled).toBe(false);

    fixture.componentInstance.working = true;
    fixture.detectChanges();

    expect(download.disabled).toBe(true);
  });
});
