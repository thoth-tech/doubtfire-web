import type {PDFDocumentProxy} from 'ng2-pdf-viewer';
import {vi} from 'vitest';
import {beforeEach, describe, expect, it} from 'vitest';
import {HttpHeaders, HttpResponse} from '@angular/common/http';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {FileDownloaderService} from '../file-downloader/file-downloader.service';
import {SafePipe} from '../pipes/safe.pipe';
import {AlertService} from '../services/alert.service';
import {fPdfViewerComponent} from './pdf-viewer.component';

vi.mock('ng2-pdf-viewer', () => ({PdfViewerComponent: class PdfViewerComponent {}}));

describe('fPdfViewerComponent', () => {
  let fixture: ComponentFixture<fPdfViewerComponent>;
  let component: fPdfViewerComponent;
  let downloader: {
    downloadBlob: ReturnType<typeof vi.fn>;
    releaseBlob: ReturnType<typeof vi.fn>;
    downloadBlobToFileWithFeedback: ReturnType<typeof vi.fn>;
    downloadFileWithFeedback: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    localStorage.clear();
    downloader = {
      downloadBlob: vi.fn(),
      releaseBlob: vi.fn(),
      downloadBlobToFileWithFeedback: vi.fn(),
      downloadFileWithFeedback: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [fPdfViewerComponent, SafePipe],
      providers: [
        {provide: FileDownloaderService, useValue: downloader},
        {provide: AlertService, useValue: {error: vi.fn()}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(fPdfViewerComponent);
    component = fixture.componentInstance;
  });

  it('shows a finite loading state and labelled wrapping toolbar for the actual filename', () => {
    fixture.componentRef.setInput('filename', 'A very long feedback document name.pdf');
    fixture.componentRef.setInput('pdfUrl', '/comments/3');
    fixture.detectChanges();

    expect(component.loadState).toBe('loading');
    expect(downloader.downloadBlob).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Loading PDF preview');
    expect(fixture.nativeElement.textContent).toContain('A very long feedback document name.pdf');
    expect(fixture.nativeElement.querySelector('[aria-label="Search this PDF"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Zoom out PDF"]')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector(
        '[aria-label="Viewer mode: OnTrack. Switch to browser viewer"]',
      ),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector(
        '[aria-label="Download PDF: A very long feedback document name.pdf"]',
      ),
    ).toBeTruthy();
  });

  it('moves from retrieval to ready and exposes search and bounded zoom controls', () => {
    fixture.componentRef.setInput('pdfUrl', '/comments/4');
    fixture.detectChanges();
    const success = downloader.downloadBlob.mock.calls[0][1] as (
      url: string,
      response: HttpResponse<Blob>,
    ) => void;
    success('blob:ready', new HttpResponse({body: new Blob(['pdf']), headers: new HttpHeaders()}));
    component.onLoaded({numPages: 2} as PDFDocumentProxy);
    fixture.detectChanges();

    expect(component.loadState).toBe('ready');
    expect(component.canZoomIn).toBe(true);
    expect(component.canZoomOut).toBe(true);
    const search = fixture.nativeElement.querySelector(
      '[aria-label="Search this PDF"]',
    ) as HTMLInputElement;
    expect(search.disabled).toBe(false);

    for (let index = 0; index < 30; index++) {
      component.zoomIn();
    }
    expect(component.zoomValue).toBe(2.5);
    for (let index = 0; index < 30; index++) {
      component.zoomOut();
    }
    expect(component.zoomValue).toBe(0.5);
  });

  it('shows recoverable network and parser error states without a perpetual spinner', () => {
    fixture.componentRef.setInput('filename', 'broken.pdf');
    fixture.componentRef.setInput('pdfUrl', '/comments/broken');
    fixture.detectChanges();
    const failure = downloader.downloadBlob.mock.calls[0][2] as (error: unknown) => void;
    failure(new Error('offline'));
    fixture.detectChanges();

    let alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(component.loadState).toBe('error');
    expect(alert.textContent).toContain('PDF preview unavailable');
    expect(alert.textContent).toContain('broken.pdf');
    expect(fixture.nativeElement.querySelector('mat-spinner')).toBeNull();

    component.pdfBlobUrl = 'blob:broken';
    component.onPdfError(new Error('parse'));
    fixture.detectChanges();
    alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('retry or download');
  });

  it('renders useful empty and preview-off states with recovery actions', () => {
    fixture.detectChanges();
    expect(component.loadState).toBe('empty');
    expect(fixture.nativeElement.textContent).toContain('No PDF to preview');

    component.pdfBlobUrl = 'blob:preview';
    component.loadState = 'ready';
    component.togglePreview();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Preview is off');
    expect(fixture.nativeElement.textContent).toContain('Show preview');
    expect(fixture.nativeElement.textContent).toContain('Download PDF');
  });

  it('names the viewer mode and dispatches the real filename through the shared helper', () => {
    fixture.componentRef.setInput('filename', 'Student evidence.pdf');
    fixture.componentRef.setInput('pdfUrl', 'blob:evidence');
    fixture.detectChanges();
    component.loadState = 'ready';

    component.toggleViewerMode();
    expect(component.viewerMode).toBe('browser');
    expect(localStorage.getItem('pdfViewerMode')).toBe('browser');

    component.downloadPdf();
    expect(downloader.downloadBlobToFileWithFeedback).toHaveBeenCalledWith(
      'blob:evidence',
      'Student evidence.pdf',
    );
  });

  it('releases stale and owned network blobs but not caller-owned blob URLs', () => {
    fixture.componentRef.setInput('pdfUrl', '/comments/old');
    fixture.detectChanges();
    const oldSuccess = downloader.downloadBlob.mock.calls[0][1] as (
      url: string,
      response: HttpResponse<Blob>,
    ) => void;

    fixture.componentRef.setInput('pdfUrl', '/comments/new');
    fixture.detectChanges();
    oldSuccess('blob:stale', new HttpResponse({body: new Blob(['old'])}));
    expect(downloader.releaseBlob).toHaveBeenCalledWith('blob:stale');

    const newSuccess = downloader.downloadBlob.mock.calls[1][1] as (
      url: string,
      response: HttpResponse<Blob>,
    ) => void;
    newSuccess('blob:owned', new HttpResponse({body: new Blob(['new'])}));
    fixture.destroy();
    expect(downloader.releaseBlob).toHaveBeenCalledWith('blob:owned');

    const callerFixture = TestBed.createComponent(fPdfViewerComponent);
    callerFixture.componentRef.setInput('pdfUrl', 'blob:caller-owned');
    callerFixture.detectChanges();
    callerFixture.destroy();
    expect(downloader.releaseBlob).not.toHaveBeenCalledWith('blob:caller-owned');
  });
});
