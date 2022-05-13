import { Injectable } from '@angular/core';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { NotificationComponent } from './notification.component';

@Injectable({
  providedIn: 'root',
})
export class UserNotificationSettingsModalService {
  constructor(public dialog: MatDialog) { }

  public show(task: any) {
    let dialogRef: MatDialogRef<NotificationComponent, any>;
    dialogRef = this.dialog.open(NotificationComponent, {
      panelClass: 'custom-dialog-class',
    });
  }
}
