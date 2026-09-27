import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
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

describe('fPdfViewerComponent theme full screen', () => {
  let component: fPdfViewerComponent;
  let fixture: ComponentFixture<fPdfViewerComponent>;

  beforeEach(async () => {
    localStorage.clear();
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

  describe('full screen', () => {
    function setDocumentProperty(name: string, value: unknown): void {
      Object.defineProperty(document, name, {configurable: true, value});
    }

    function fullscreenButton(): HTMLButtonElement | null {
      return fixture.nativeElement.querySelector('button[aria-label="Full screen"]');
    }

    function container(): HTMLElement {
      return fixture.nativeElement.querySelector('#pdfContainer');
    }

    // jsdom has no Fullscreen API. The button is decided when the viewer is made,
    // so these tests make their own viewer after stubbing it.
    function renderWithFullscreen(): void {
      setDocumentProperty('fullscreenEnabled', true);
      setDocumentProperty('fullscreenElement', null);
      fixture.destroy();
      fixture = TestBed.createComponent(fPdfViewerComponent);
      component = fixture.componentInstance;
      component.pdfBlobUrl = 'blob:http://localhost/fake-pdf';
      fixture.detectChanges();
    }

    afterEach(() => {
      for (const name of ['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen']) {
        delete (document as unknown as Record<string, unknown>)[name];
      }
    });

    it('has no full-screen button where the browser cannot go full screen', () => {
      component.pdfBlobUrl = 'blob:http://localhost/fake-pdf';
      fixture.detectChanges();

      expect(fullscreenButton()).toBeNull();
    });

    it('goes full screen from the button and follows the browser when Esc leaves it', () => {
      renderWithFullscreen();
      const requestFullscreen = vi.fn(() => {
        setDocumentProperty('fullscreenElement', container());
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      });
      container().requestFullscreen = requestFullscreen;
      const resize = vi.fn();
      window.addEventListener('resize', resize);

      fullscreenButton().click();
      fixture.detectChanges();

      expect(requestFullscreen).toHaveBeenCalledOnce();
      expect(fullscreenButton().getAttribute('aria-pressed')).toBe('true');
      // The pages are sized on window resize, so the viewer asks for one.
      expect(resize).toHaveBeenCalled();

      // Esc is handled by the browser, which only reports the change.
      setDocumentProperty('fullscreenElement', null);
      document.dispatchEvent(new Event('fullscreenchange'));
      fixture.detectChanges();

      expect(fullscreenButton().getAttribute('aria-pressed')).toBe('false');
      window.removeEventListener('resize', resize);
    });

    it('leaves full screen from the same button', () => {
      renderWithFullscreen();
      setDocumentProperty('fullscreenElement', container());
      document.dispatchEvent(new Event('fullscreenchange'));
      fixture.detectChanges();
      const exitFullscreen = vi.fn(() => Promise.resolve());
      setDocumentProperty('exitFullscreen', exitFullscreen);

      fullscreenButton().click();

      expect(exitFullscreen).toHaveBeenCalledOnce();
    });
  });
});
