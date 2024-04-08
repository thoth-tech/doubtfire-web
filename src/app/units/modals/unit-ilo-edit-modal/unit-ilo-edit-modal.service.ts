import { Injectable } from '@angular/core';
import { Unit } from 'src/app/api/models/unit';
import { LearningOutcome } from 'src/app/api/models/learning-outcome';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { UnitILOEditModalComponent } from './unit-ilo-edit-modal.component';

@Injectable({
  providedIn: 'root',
})
export class UnitILOEditModalService {
  constructor(public dialog: MatDialog) {}

  public show(unit: Unit, ilo: LearningOutcome) {
    let dialogRef: MatDialogRef<UnitILOEditModalComponent, any>;

    dialogRef = this.dialog.open(UnitILOEditModalComponent, {
      data: {
        unit,
        ilo,
      },
    });

    dialogRef.afterOpened().subscribe((result: any) => {});

    dialogRef.afterClosed().subscribe((result: any) => {});
  }
}
