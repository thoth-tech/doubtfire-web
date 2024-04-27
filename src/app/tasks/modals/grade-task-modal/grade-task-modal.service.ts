import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { GradeTaskModalComponent } from './grade-task-modal.component';

@Injectable({
  providedIn: 'root',
})
export class GradeTaskModalService {
  constructor(public dialog: MatDialog) {}

  public show(task: any) {
    let dialogRef: MatDialogRef<any, any>;
    dialogRef = this.dialog.open(GradeTaskModalComponent, {
      data: { task: task },
      position: { top: '2.5%' }
    });
  }
}