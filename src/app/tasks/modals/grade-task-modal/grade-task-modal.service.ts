import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { GradeTaskModalComponent } from './grade-task-modal.component';

@Injectable({
  providedIn: 'root'
})
export class GradeTaskModalService {
  constructor(private dialog: MatDialog) {}

  show(task: any): void {
    const dialogRef = this.dialog.open(GradeTaskModalComponent, {
      width: '600px',
      data: { task }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Handle the result if needed
        console.log('The dialog was closed', result);
      }
    });
  }
}
