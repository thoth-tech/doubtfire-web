import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {AttachmentConfirmationDialogComponent} from './attachment-confirmation-dialog.component';

describe('attachment confirmation keyboard controls', () => {
  let fixture: ComponentFixture<AttachmentConfirmationDialogComponent>;
  let dialog: {close: ReturnType<typeof vi.fn>};

  beforeEach(async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:attachment');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    dialog = {close: vi.fn()};
    await TestBed.configureTestingModule({
      declarations: [AttachmentConfirmationDialogComponent],
      imports: [MatButtonModule, MatDialogModule, MatIconModule],
      providers: [
        {provide: MatDialogRef, useValue: dialog},
        {
          provide: MAT_DIALOG_DATA,
          useValue: {file: new File(['pdf'], 'work.pdf', {type: 'application/pdf'})},
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AttachmentConfirmationDialogComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  it.each([
    ['Cancel', false],
    ['Post Attachment', true],
  ] as const)('allows Enter to activate %s', (label, confirmed) => {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const button = buttons.find((candidate) => candidate.textContent.trim() === label);
    expect(button.type).toBe('button');
    button.focus();
    expect(document.activeElement).toBe(button);

    const reachedOutsideDialog = vi.fn();
    fixture.nativeElement.addEventListener('keydown', reachedOutsideDialog);
    const enter = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true});
    button.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    // Keep native activation while containing the dialog's Enter from outer shortcuts.
    expect(reachedOutsideDialog).not.toHaveBeenCalled();
    expect(dialog.close).not.toHaveBeenCalled();
    // jsdom does not synthesize the native button activation from Enter.
    button.click();

    expect(dialog.close).toHaveBeenCalledExactlyOnceWith(confirmed);
  });

  it('does not swallow Enter inside the audio preview controls', () => {
    fixture.componentInstance.file = new File(['audio'], 'feedback.mp3', {type: 'audio/mpeg'});
    fixture.detectChanges();
    const audio: HTMLAudioElement = fixture.nativeElement.querySelector('audio');
    expect(audio.controls).toBe(true);
    const enter = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true});
    audio.dispatchEvent(enter);

    expect(enter.defaultPrevented).toBe(false);
    expect(dialog.close).not.toHaveBeenCalled();
  });
});
