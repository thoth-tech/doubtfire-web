import {HttpEventType, HttpResponse, provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {AlertService} from '../services/alert.service';
import {FileDropComponent} from './file-drop.component';

describe('FileDropComponent accessible upload actions', () => {
  let fixture: ComponentFixture<FileDropComponent>;
  let http: HttpTestingController;
  const alert = {success: vi.fn(), error: vi.fn()};

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FileDropComponent],
      imports: [MatButtonModule, MatIconModule, MatProgressBarModule, MatProgressSpinnerModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {provide: AlertService, useValue: alert},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(FileDropComponent);
    fixture.componentRef.setInput('mode', 'endpoint');
    fixture.componentRef.setInput('endpoint', '/demo-upload');
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const status = () => fixture.nativeElement.querySelector('[role="status"]').textContent;
  const action = () =>
    fixture.nativeElement.querySelector('button[aria-label]') as HTMLButtonElement;
  const choose = () => fixture.nativeElement.querySelector('button') as HTMLButtonElement;

  function selectFile(): File {
    const file = new File(['demo'], 'example.txt', {type: 'text/plain'});
    const input = fixture.nativeElement.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {configurable: true, value: [file]});
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    return file;
  }

  it('names the action before selection and allows cancellation while progress is still zero', () => {
    expect(action().getAttribute('aria-label')).toBe('Upload file');
    expect(action().disabled).toBe(true);
    selectFile();
    expect(status()).toContain('example.txt selected');
    expect(action().disabled).toBe(false);
    action().click();
    fixture.detectChanges();
    const request = http.expectOne('/demo-upload');
    expect(action().getAttribute('aria-label')).toBe('Cancel upload');
    expect(choose().disabled).toBe(true);
    expect(choose().textContent).toContain('Choose file');
    expect(status()).toContain('Uploading example.txt');
    expect(fixture.nativeElement.querySelector('mat-progress-bar').getAttribute('aria-label')).toBe(
      'File upload progress',
    );
    action().click();
    fixture.detectChanges();
    expect(request.cancelled).toBe(true);
    expect(status()).toBe('Upload cancelled.');
    expect(choose().disabled).toBe(false);
    expect(action().getAttribute('aria-label')).toBe('Upload file');
  });

  it('announces completion without repeating an announcement for every progress tick', () => {
    const success = vi.fn();
    fixture.componentInstance.uploadSuccess.subscribe(success);
    selectFile();
    action().click();
    const request = http.expectOne('/demo-upload');
    fixture.detectChanges();
    const uploadingMessage = status();
    request.event({type: HttpEventType.UploadProgress, loaded: 5, total: 10});
    fixture.detectChanges();
    expect(status()).toBe(uploadingMessage);
    request.flush({ok: true});
    fixture.detectChanges();
    expect(success).toHaveBeenCalledWith(expect.any(HttpResponse));
    expect(status()).toBe('File uploaded successfully.');
    expect(choose().disabled).toBe(false);
  });

  it('keeps a failure message available and gives a retry path', () => {
    selectFile();
    action().click();
    http.expectOne('/demo-upload').flush({}, {status: 500, statusText: 'Error'});
    fixture.detectChanges();
    expect(status()).toContain('Upload failed. Choose the file again to retry.');
    selectFile();
    expect(action().disabled).toBe(false);
    expect(status()).toContain('example.txt selected');
  });

  it('retains the file event used by local consumers and never emits an absent file', () => {
    fixture.componentRef.setInput('mode', 'event');
    const dropped = vi.fn();
    fixture.componentInstance.filesDropped.subscribe(dropped);
    fixture.componentInstance.upload();
    expect(dropped).not.toHaveBeenCalled();
    const file = selectFile();
    action().click();
    fixture.detectChanges();
    expect(dropped).toHaveBeenCalledExactlyOnceWith([file]);
    expect(status()).toBe('example.txt selected.');
    http.expectNone('/demo-upload');
  });
});
