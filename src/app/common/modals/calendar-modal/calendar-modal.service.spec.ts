import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {CalendarModalComponent} from './calendar-modal.component';
import {CalendarModalService} from './calendar-modal.service';

describe('CalendarModalService', () => {
  let dialog: {open: ReturnType<typeof vi.fn>};
  let service: CalendarModalService;

  beforeEach(() => {
    dialog = {open: vi.fn()};
    TestBed.configureTestingModule({
      providers: [CalendarModalService, {provide: MatDialog, useValue: dialog}],
    });
    service = TestBed.inject(CalendarModalService);
  });

  it('opens a safe-area-aware responsive dialog and restores focus to its launch control', () => {
    service.show();

    expect(dialog.open).toHaveBeenCalledWith(CalendarModalComponent, {
      height: 'min-content',
      width: 'calc(100vw - 2rem)',
      maxWidth: '900px',
      maxHeight: 'calc(100dvh - 2rem)',
      autoFocus: 'dialog',
      restoreFocus: true,
      panelClass: 'calendar-modal-dialog',
    });
  });
});
