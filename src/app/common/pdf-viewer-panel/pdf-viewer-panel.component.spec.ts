import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FileDownloaderService} from '../file-downloader/file-downloader.service';
import {PdfViewerPanelComponent} from './pdf-viewer-panel.component';

const emptyProvider = {};

describe('PdfViewerPanelComponent', () => {
  let component: PdfViewerPanelComponent;
  let fixture: ComponentFixture<PdfViewerPanelComponent>;

  beforeEach(async () => {
    // The real template is rendered here on purpose. The accessibility fix
    // (A11Y-KB05) lives in the footer markup, so the tests need the actual DOM
    // rather than a blank template.
    await TestBed.configureTestingModule({
      declarations: [PdfViewerPanelComponent],
      providers: [{provide: FileDownloaderService, useValue: emptyProvider}],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PdfViewerPanelComponent);
    component = fixture.componentInstance;
  });

  const footer = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the resources control as a real button so keyboard users can reach it', () => {
    component.resourcesUrl = 'https://example.test/resources.zip';
    fixture.detectChanges();

    // Before the fix this control was an anchor with no href, which is not
    // focusable and carries no link role, so the keyboard tab order skipped it.
    expect(footer().querySelector('a.btn-primary')).toBeNull();

    const resourcesButton = footer().querySelector('button.btn-primary');
    expect(resourcesButton).not.toBeNull();
    expect(resourcesButton!.getAttribute('type')).toBe('button');
  });

  it('keeps a name on the PDF button when the visible label is hidden', () => {
    // With no resources the " PDF" text is inside a hidden span, so the button
    // needs an aria-label to keep an accessible name instead of announcing only
    // "button".
    component.resourcesUrl = undefined;
    fixture.detectChanges();

    const pdfButton = footer().querySelector('button.btn-success');
    expect(pdfButton).not.toBeNull();
    expect(pdfButton!.getAttribute('aria-label')).toBe('Download submission PDF');
  });

  it('hides both download icons from assistive technology', () => {
    component.resourcesUrl = 'https://example.test/resources.zip';
    fixture.detectChanges();

    const icons = footer().querySelectorAll('mat-icon');
    expect(icons.length).toBe(2);
    icons.forEach((icon) => expect(icon.getAttribute('aria-hidden')).toBe('true'));
  });
});
