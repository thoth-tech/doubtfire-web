import {beforeEach, describe, expect, it} from 'vitest';
import {CommonModule} from '@angular/common';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {of} from 'rxjs';
import {UserService} from 'src/app/api/services/user.service';
import {expectAccessible} from 'src/app/common/testing/accessibility';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {FileUploaderComponent} from './file-uploader.component';

describe('File uploader accessible controls', () => {
  let fixture: ComponentFixture<FileUploaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FileUploaderComponent],
      imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule],
      providers: [
        {provide: UserService, useValue: {}},
        {provide: DoubtfireConstants, useValue: {ExternalName: of('OnTrack')}},
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FileUploaderComponent);
    fixture.componentRef.setInput('files', [{name: 'Submission evidence', type: 'document'}]);
  });

  function selectFile(): void {
    const fileInput: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['Demonstration evidence'], 'evidence.pdf', {type: 'application/pdf'})],
    });
    fileInput.dispatchEvent(new Event('change', {bubbles: true}));
    fixture.detectChanges();
  }

  it.each([false, true])(
    'names the removal action and permits changing the selected file (single drop zone: %s)',
    async (singleDropZone) => {
      fixture.componentRef.setInput('singleDropZone', singleDropZone);
      fixture.detectChanges();
      selectFile();

      const remove: HTMLButtonElement =
        fixture.nativeElement.querySelector('button[mat-icon-button]');
      expect(remove.getAttribute('aria-label')).toBe('Remove evidence.pdf');
      expect(remove.type).toBe('button');
      expect(remove.tabIndex).toBe(0);
      await fixture.whenStable();
      await expectAccessible(fixture.nativeElement);
      remove.focus();
      expect(document.activeElement).toBe(remove);
      remove.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.uploadZones[0].model).toBeNull();
      expect(fixture.componentInstance.isReady).toBe(false);
      const dropZone: HTMLButtonElement =
        fixture.nativeElement.querySelector('button.file-drop-zone');
      expect(dropZone).not.toBeNull();
      expect(dropZone.closest('[hidden]')).toBeNull();
      expect(dropZone.textContent).toContain('Drop your PDF here');
    },
  );

  it('exposes a named progress bar with the current upload percentage', async () => {
    fixture.detectChanges();
    selectFile();
    fixture.componentInstance.isUploading = true;
    fixture.componentInstance.uploadingInfo = {
      progress: 42,
      success: false,
      error: null,
      complete: false,
    };
    fixture.detectChanges();

    const progress: HTMLElement = fixture.nativeElement.querySelector('[role="progressbar"]');
    expect(progress.getAttribute('aria-label')).toBe('File upload progress');
    expect(progress.getAttribute('aria-valuemin')).toBe('0');
    expect(progress.getAttribute('aria-valuemax')).toBe('100');
    expect(progress.getAttribute('aria-valuenow')).toBe('42');
    await fixture.whenStable();
    await expectAccessible(fixture.nativeElement);
  });
});
