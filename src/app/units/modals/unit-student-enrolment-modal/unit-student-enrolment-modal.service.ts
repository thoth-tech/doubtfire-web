import { Injectable } from '@angular/core';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { UnitStudentEnrolmentModalComponent } from './unit-student-enrolment-modal.component';

@Injectable({
  providedIn: 'root',
})
export class UnitStudentEnrolmentModalService {
  constructor(public dialog: MatDialog) {}

  public show(unit: any) {
    let dialogRef: MatDialogRef<UnitStudentEnrolmentModalComponent, any>;
    dialogRef = this.dialog.open(UnitStudentEnrolmentModalComponent, {position: {top: '2.5%'}});
    dialogRef.updateSize("42.5%", "");
    dialogRef.componentInstance.unit = unit;
  }
}