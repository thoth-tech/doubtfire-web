import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {HttpClient} from '@angular/common/http';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {Observable, Subject, of} from 'rxjs';
import {D2lAssessmentMappingService} from 'src/app/api/models/doubtfire-model';
import {Unit} from 'src/app/api/models/unit';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {D2lTransferComponent} from './d2l-transfer.component';

describe('D2lTransferComponent', () => {
  let fixture: ComponentFixture<D2lTransferComponent>;
  let component: D2lTransferComponent;
  let endpoint: Subject<string>;
  let transfer: Subject<unknown>;
  let post: ReturnType<typeof vi.fn>;
  let openWindow: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    endpoint = new Subject();
    transfer = new Subject();
    post = vi.fn((url: string) => (url.endsWith('/d2l/grades') ? transfer : of('')));
    openWindow = vi.spyOn(window, 'open').mockReturnValue(null);

    const get = (url: string): Observable<unknown> => {
      if (url.endsWith('/d2l/endpoint')) {
        return endpoint;
      }
      return of(true);
    };

    const unit = {
      id: 1,
      code: 'SIT101',
      loadD2lMapping: () => of({id: 4, orgUnitId: '123', gradeObjectId: '9'}),
    } as unknown as Unit;

    await TestBed.configureTestingModule({
      declarations: [D2lTransferComponent],
      imports: [MatButtonModule, MatDialogModule, MatIconModule],
      providers: [
        {provide: MAT_DIALOG_DATA, useValue: unit},
        {provide: MatDialogRef, useValue: {close: vi.fn()}},
        {provide: AlertService, useValue: {success: vi.fn(), error: vi.fn()}},
        {provide: D2lAssessmentMappingService, useValue: {}},
        {provide: HttpClient, useValue: {get, post}},
        {provide: DoubtfireConstants, useValue: {API_URL: 'https://api.test'}},
        {provide: FileDownloaderService, useValue: {downloadFile: vi.fn()}},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(D2lTransferComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    openWindow.mockRestore();
  });

  function steps(): HTMLLIElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('ol.d2l-steps > li'));
  }

  function buttonNamed(label: string): HTMLButtonElement {
    return Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => button.textContent.replace(/\s+/g, ' ').includes(label),
    );
  }

  // The old dialog had an hourglass button on the waiting step that did nothing.
  it('gives the waiting step no button, and every other step a named one', () => {
    const waiting = steps().find((step) => step.textContent.includes('Wait for the email'));

    expect(waiting.querySelector('button')).toBeNull();
    expect(buttonNamed('Open D2L')).toBeTruthy();
    expect(buttonNamed('Start transfer')).toBeTruthy();
    expect(buttonNamed('Download record')).toBeTruthy();
  });

  // The weight page link was built before the D2L address arrived, so it opened
  // "undefined/d2l/...".
  it('waits for the D2L address before opening the grade item', () => {
    expect(buttonNamed('Open the grade item').disabled).toBe(true);
    component.openWeightPage();
    expect(openWindow).not.toHaveBeenCalled();

    endpoint.next('https://d2l.test');
    fixture.detectChanges();
    buttonNamed('Open the grade item').click();

    expect(openWindow).toHaveBeenCalledWith(
      'https://d2l.test/d2l/lms/grades/admin/manage/item_props_newedit.d2l?objectId=9&ou=123&scroll=weight',
      '_blank',
    );
  });

  it('starts one transfer however often the button is pressed', () => {
    component.startTransfer();
    component.startTransfer();
    fixture.detectChanges();

    expect(post).toHaveBeenCalledTimes(1);
    expect(buttonNamed('Starting').disabled).toBe(true);

    transfer.next({});
    fixture.detectChanges();

    expect(buttonNamed('Start transfer').disabled).toBe(false);
  });
});
