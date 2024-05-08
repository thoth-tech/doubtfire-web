import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ProgressModalComponent } from './progress-modal.component';

@Injectable({
  providedIn: 'root'
})
export class ProgressModalService {
  constructor(private dialog: MatDialog) {}

  show(title: string, message: string, promise?: Promise<any>): void {
    const dialogRef = this.dialog.open(ProgressModalComponent, {
      data: {
        title: title,
        message: message
      }
    });

    if (promise) {
      promise.finally(() => {
        dialogRef.close();
      });
    }
  }
}