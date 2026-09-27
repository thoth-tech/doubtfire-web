import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CommonModule} from '@angular/common';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {BehaviorSubject} from 'rxjs';
import {UserService} from 'src/app/api/services/user.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {FileUploaderComponent} from './file-uploader.component';

describe('FileUploaderComponent responsive selected-file state', () => {
  let fixture: ComponentFixture<FileUploaderComponent>;
  let component: FileUploaderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        NoopAnimationsModule,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatProgressBarModule,
      ],
      declarations: [FileUploaderComponent],
      providers: [
        {
          provide: UserService,
          useValue: {currentUser: {authenticationToken: 'token', username: 'demo_student'}},
        },
        {provide: DoubtfireConstants, useValue: {ExternalName: new BehaviorSubject('OnTrack')}},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FileUploaderComponent);
    component = fixture.componentInstance;
    component.files = {file0: {name: 'Learning Summary Report', type: 'document'}};
    component.url = '/projects/1/portfolio';
    fixture.detectChanges();
  });

  it('keeps a long selected filename readable and exposes a named remove control', () => {
    const file = new File(
      ['portfolio'],
      'A very long learning summary report filename that must remain readable on a phone.pdf',
      {type: 'application/pdf'},
    );
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {configurable: true, value: [file]});

    component.onFileSelected({target: input} as unknown as Event, component.shownUploadZones[0]);
    fixture.detectChanges();

    const name = fixture.nativeElement.querySelector('.selected-upload__name') as HTMLElement;
    const remove = fixture.nativeElement.querySelector(
      '.selected-upload button',
    ) as HTMLButtonElement;
    expect(name.textContent).toContain(file.name);
    expect(name.getAttribute('title')).toBe(file.name);
    expect(remove.getAttribute('aria-label')).toBe(`Remove ${file.name}`);
    expect(component.readyToUpload()).toBe(true);
  });

  it('aborts a slow upload and returns control to the owning flow', () => {
    const abort = vi.fn();
    const onCancelUpload = vi.fn();
    component.onCancelUpload = onCancelUpload;
    component.isUploading = true;
    component.uploadingInfo = {progress: 20, success: false, error: '', complete: false};
    (component as unknown as {activeRequest: {abort: () => void}}).activeRequest = {abort};

    component.cancelUpload();

    expect(abort).toHaveBeenCalledOnce();
    expect(onCancelUpload).toHaveBeenCalledOnce();
    expect(component.isUploading).toBe(false);
    expect(component.uploadingInfo).toBeNull();
  });

  it('keeps selected files after a server failure and permits an explicit retry', async () => {
    const requests: FakeRequest[] = [];
    class FakeRequest {
      upload: {onprogress?: (event: ProgressEvent) => void} = {};
      readyState = 0;
      status = 503;
      responseText = '{"error":"Conversion service unavailable"}';
      onreadystatechange?: () => void;
      open = vi.fn();
      setRequestHeader = vi.fn();
      abort = vi.fn();

      constructor() {
        requests.push(this);
      }

      send = vi.fn(() => {
        this.readyState = 4;
        this.onreadystatechange?.();
      });
    }
    vi.stubGlobal('XMLHttpRequest', FakeRequest);

    const file = new File(['submission'], 'submission.pdf', {type: 'application/pdf'});
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {configurable: true, value: [file]});
    component.onFileSelected({target: input} as unknown as Event, component.shownUploadZones[0]);

    component.initiateUploadInternal();
    await Promise.resolve();

    expect(component.uploadingInfo).toMatchObject({
      complete: true,
      success: false,
      error: 'Conversion service unavailable',
    });
    expect(component.hasSelectedFiles()).toBe(true);

    component.initiateUploadInternal();
    await Promise.resolve();
    expect(requests).toHaveLength(2);
    vi.unstubAllGlobals();
  });
});

describe('FileUploaderComponent extension validation', () => {
  let component: FileUploaderComponent;

  beforeEach(() => {
    component = new FileUploaderComponent({} as never, {} as never);
    (component as never as {refreshShownUploadZones: unknown}).refreshShownUploadZones = vi.fn();
    (component as never as {updateReadyState: unknown}).updateReadyState = vi.fn();
    (component as never as {readyToUpload: unknown}).readyToUpload = vi.fn(() => true);
  });

  const zoneFor = (filename: string) => ({
    model: [{name: filename}] as unknown,
    accepts: ['pdf', 'ps'],
    display: {error: null as unknown},
  });

  it('rejects a filename that only ends with the accepted letters', () => {
    const zone = zoneFor('figure.eps');
    (component as never as {shownUploadZones: unknown}).shownUploadZones = [zone];

    component.validateFiles();

    expect(zone.model).toBeNull();
    expect(zone.display.error).toBe(true);
  });

  it('accepts a file with a real accepted extension', () => {
    const zone = zoneFor('report.pdf');
    (component as never as {shownUploadZones: unknown}).shownUploadZones = [zone];

    component.validateFiles();

    expect(zone.model).not.toBeNull();
  });
});
