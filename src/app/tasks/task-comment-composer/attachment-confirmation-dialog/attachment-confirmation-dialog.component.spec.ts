import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {AttachmentConfirmationDialogComponent} from './attachment-confirmation-dialog.component';

describe('AttachmentConfirmationDialogComponent keyboard actions', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AttachmentConfirmationDialogComponent],
      providers: [
        {provide: MatDialogRef, useValue: {close: vi.fn()}},
        {
          provide: MAT_DIALOG_DATA,
          useValue: {file: new File(['value\n7\n'], 'scores.csv', {type: 'text/csv'})},
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('allows native Enter activation without forwarding Enter to the comment composer', () => {
    const fixture = TestBed.createComponent(AttachmentConfirmationDialogComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const parentKeydown = vi.fn();
    host.addEventListener('keydown', parentKeydown);

    for (const button of host.querySelectorAll('button')) {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      button.dispatchEvent(event);
      // Preventing this default action suppresses native button activation in browsers.
      expect(event.defaultPrevented).toBe(false);
      expect(parentKeydown).not.toHaveBeenCalled();
    }

    host.querySelectorAll('button')[0].click();
    expect(TestBed.inject(MatDialogRef).close).toHaveBeenLastCalledWith(false);
    host.querySelectorAll('button')[1].click();
    expect(TestBed.inject(MatDialogRef).close).toHaveBeenLastCalledWith(true);
  });
});
