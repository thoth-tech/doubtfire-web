import {Injectable} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {Task} from 'src/app/api/models/task';
import {CalendarModalComponent} from './calendar-modal.component';

@Injectable({
  providedIn: 'root',
})
export class CalendarModalService {
  constructor(public dialog: MatDialog) {}

  public show(_task?: Task) {
    this.dialog.open(CalendarModalComponent, {
      height: 'min-content',
      width: 'calc(100vw - 2rem)',
      maxWidth: '900px',
      maxHeight: 'calc(100dvh - 2rem)',
      autoFocus: 'dialog',
      restoreFocus: true,
      panelClass: 'calendar-modal-dialog',
    });
  }
}
