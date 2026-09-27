import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FileDownloaderService} from '../file-downloader/file-downloader.service';
import {SafePipe} from '../pipes/safe.pipe';
import {AlertService} from '../services/alert.service';
import {FileViewerComponent} from './file-viewer.component';

describe('FileViewerComponent', () => {
  let component: FileViewerComponent;
  let fixture: ComponentFixture<FileViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FileViewerComponent, SafePipe],
      providers: [
        // The component releases its blob URL on destroy.
        {provide: FileDownloaderService, useValue: {releaseBlob: () => undefined}},
        {provide: AlertService, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(FileViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('names the HTML preview even when no filename is available', () => {
    component.fileType = 'html';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('iframe')?.title).toBe('Submission preview');
  });

  it('does not expose an unrelated frame when displaying a PDF', () => {
    component.fileType = 'pdf';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
  });

  // WEBUX-08: the load bar reads a 0-100 percentage, not a 0..1 fraction.
  it('scales pdf load progress to a 0-100 percentage', () => {
    const c = component as never as {
      onProgress: (p: {loaded: number; total: number}) => void;
      pdfLoadingProgressPercentage: number;
      pdfLoadingTotalKnown: boolean;
    };

    c.onProgress({loaded: 500, total: 1000});

    expect(c.pdfLoadingProgressPercentage).toBe(50);
    expect(c.pdfLoadingTotalKnown).toBe(true);
  });

  it('falls back to an indeterminate bar when the total is unknown', () => {
    const c = component as never as {
      onProgress: (p: {loaded: number; total: number}) => void;
      pdfLoadingProgressPercentage: number;
      pdfLoadingTotalKnown: boolean;
    };

    c.onProgress({loaded: 100, total: 0});

    expect(c.pdfLoadingProgressPercentage).toBe(0);
    expect(c.pdfLoadingTotalKnown).toBe(false);
  });

  // An iframe with no height of its own is 150px tall, which cut a similarity report
  // off after its first lines, and an untitled iframe has no accessible name.
  it('gives an HTML preview a title and a height of its own', () => {
    const c = component as never as {fileType: string; blobUrl: string};
    c.fileType = 'html';
    c.blobUrl = 'blob:http://localhost/preview';
    fixture.detectChanges();

    const frame: HTMLIFrameElement = fixture.nativeElement.querySelector('iframe');
    expect(frame.getAttribute('title')).toBe('Submission preview');
    expect(frame.hasAttribute('height')).toBe(false);
    expect(frame.className).toContain('h-[32rem]');
  });
});
