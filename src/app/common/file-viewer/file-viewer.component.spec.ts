import {beforeEach, describe, expect, it} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FileViewerComponent} from './file-viewer.component';

describe('FileViewerComponent', () => {
  let component: FileViewerComponent;
  let fixture: ComponentFixture<FileViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FileViewerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FileViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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
});
