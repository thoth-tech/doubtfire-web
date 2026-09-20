import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {SafePipe} from '../pipes/safe.pipe';
import {fPdfViewerComponent} from './pdf-viewer.component';

vi.mock('ng2-pdf-viewer', () => ({
  PdfViewerComponent: class {},
  PDFDocumentProxy: class {},
}));

describe('fPdfViewerComponent', () => {
  let component: fPdfViewerComponent;
  let fixture: ComponentFixture<fPdfViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [fPdfViewerComponent, SafePipe],
      imports: [FormsModule],
      providers: [
        {provide: FileDownloaderService, useValue: {releaseBlob: () => {}}},
        {provide: AlertService, useValue: {error: () => {}}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(fPdfViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('labels the two zoom buttons with different accessible names instead of both announcing "Zoom in PDF button"', () => {
    const buttons = fixture.nativeElement.querySelectorAll('#pdfActions button');
    expect(buttons.length).toBe(2);

    const zoomOutButton = buttons[0] as HTMLButtonElement;
    const zoomInButton = buttons[1] as HTMLButtonElement;

    expect(zoomOutButton.getAttribute('aria-label')).toBe('Zoom out');
    expect(zoomInButton.getAttribute('aria-label')).toBe('Zoom in');
    expect(zoomOutButton.getAttribute('aria-label')).not.toBe(
      zoomInButton.getAttribute('aria-label'),
    );
  });

  it('gives the search field a mat-label and the loading spinner an accessible name, instead of leaving them unnamed', () => {
    const matLabel = fixture.nativeElement.querySelector('mat-form-field mat-label');
    expect(matLabel?.textContent?.trim()).toBe('Search PDF');

    const spinner = fixture.nativeElement.querySelector('mat-spinner');
    expect(spinner.getAttribute('aria-label')).toBe('Loading PDF');
  });

  it('titles the embedded PDF object so the native viewer is not an untitled embed', () => {
    component.pdfBlobUrl = 'blob:http://localhost/fake-pdf';
    component.useNativePdfViewer = true;
    fixture.detectChanges();

    const object = fixture.nativeElement.querySelector('object');
    expect(object.getAttribute('title')).toBe('Submission PDF');
  });
});
