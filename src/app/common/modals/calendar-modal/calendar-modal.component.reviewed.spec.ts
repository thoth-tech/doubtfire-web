import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CdkCopyToClipboard, Clipboard, ClipboardModule} from '@angular/cdk/clipboard';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {By} from '@angular/platform-browser';
import {Subject, of} from 'rxjs';
import {ProjectService, Webcal, WebcalService} from 'src/app/api/models/doubtfire-model';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {FileDownloaderService} from '../../file-downloader/file-downloader.service';
import {AlertService} from '../../services/alert.service';
import {ConfirmationModalService} from '../confirmation-modal/confirmation-modal.service';
import {CalendarModalComponent} from './calendar-modal.component';

const emptyProvider = {};

describe('CalendarModalComponent', () => {
  let component: CalendarModalComponent;
  let fixture: ComponentFixture<CalendarModalComponent>;
  let fileDownloaderStub: {downloadFileWithFeedback: ReturnType<typeof vi.fn>};

  beforeEach(async () => {
    fileDownloaderStub = {downloadFileWithFeedback: vi.fn()};

    await TestBed.configureTestingModule({
      declarations: [CalendarModalComponent],
      providers: [
        {provide: WebcalService, useValue: emptyProvider},
        {provide: DoubtfireConstants, useValue: {API_URL: 'https://doubtfire.test/api'}},
        {provide: AlertService, useValue: emptyProvider},
        {provide: ProjectService, useValue: emptyProvider},
        {provide: MAT_DIALOG_DATA, useValue: emptyProvider},
        {provide: ConfirmationModalService, useValue: emptyProvider},
        {provide: FileDownloaderService, useValue: fileDownloaderStub},
        {provide: DemoModeStore, useValue: {enabled: false}},
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

  it('downloads the feed as an .ics file when the webcal is enabled', () => {
    const webcal = new Webcal();
    webcal.enabled = true;
    webcal.guid = 'abc-123';
    component.webcal = webcal;

    component.downloadCalendar();

    expect(fileDownloaderStub.downloadFileWithFeedback).toHaveBeenCalledOnce();
    expect(fileDownloaderStub.downloadFileWithFeedback).toHaveBeenCalledWith(
      'https://doubtfire.test/api/webcal/abc-123',
      'ontrack-calendar.ics',
      {requestKey: 'web-calendar-ics'},
    );
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

  it('does not download when there is no webcal loaded yet', () => {
    component.webcal = null;

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
      imports: [ClipboardModule, MatIconModule, MatSlideToggleModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {provide: MAT_DIALOG_DATA, useValue: {}},
        {provide: WebcalService, useValue: {get: () => of(webcal)}},
        {provide: ProjectService, useValue: {query: () => of([])}},
        {provide: DoubtfireConstants, useValue: {API_URL: 'https://example.test/api'}},
        {provide: AlertService, useValue: alerts},
        {provide: Clipboard, useValue: clipboard},
        {provide: DemoModeStore, useValue: {enabled: false}},
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

  it('gives the adjacent icon-only copy and regenerate buttons separate accessible names', () => {
    const root: HTMLElement = fixture.nativeElement;
    const copy = root.querySelector<HTMLButtonElement>(
      'button[aria-label="Copy web calendar URL"]',
    )!;
    const regenerate = root.querySelector<HTMLButtonElement>(
      'button[aria-label="Regenerate web calendar URL"]',
    )!;
    expect(copy.getAttribute('aria-label')).toBe('Copy web calendar URL');
    expect(regenerate.getAttribute('aria-label')).toBe('Regenerate web calendar URL');
    expect(copy.disabled).toBe(false);
    expect(regenerate.disabled).toBe(false);
    expect(
      copy.compareDocumentPosition(regenerate) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
