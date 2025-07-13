import {Injectable} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {ConfirmationModalComponent} from './confirmation-modal.component';

@Injectable({
  providedIn: 'root',
})
export class ConfirmationModalService {
  constructor(private dialog: MatDialog) {}

  show(title: string, message: string, action: () => void) {
    this.dialog.open(ConfirmationModalComponent, {
      data: {title, message, action},
    });
  }
}
