// The two clipboard behaviours from the 11.0.x calendar work that the other calendar
// specs do not cover: the copy button copies the whole subscription URL, and a
// refused clipboard write is reported instead of claimed as copied.
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CdkCopyToClipboard, Clipboard, ClipboardModule} from '@angular/cdk/clipboard';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {By} from '@angular/platform-browser';
import {of} from 'rxjs';
import {ProjectService, Webcal, WebcalService} from 'src/app/api/models/doubtfire-model';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {FileDownloaderService} from '../../file-downloader/file-downloader.service';
import {AlertService} from '../../services/alert.service';
import {ConfirmationModalService} from '../confirmation-modal/confirmation-modal.service';
import {CalendarModalComponent} from './calendar-modal.component';

describe('CalendarModalComponent clipboard', () => {
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
        {provide: ConfirmationModalService, useValue: {}},
        {provide: FileDownloaderService, useValue: {}},
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarModalComponent);
    fixture.detectChanges();
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
});
