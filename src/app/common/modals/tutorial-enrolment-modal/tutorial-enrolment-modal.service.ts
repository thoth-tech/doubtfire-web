import {Injectable} from '@angular/core';
import {Task} from 'src/app/api/models/task';
import {MatDialogRef, MatDialog} from '@angular/material/dialog';
import {
  TutorialEnrolmentModalComponent,
  TutorialEnrolmentModalData,
} from './tutorial-enrolment-modal.component';

@Injectable({
  providedIn: 'root',
})
export class TutorialEnrolmentModalService {
  constructor(public dialog: MatDialog) {}

  public show(data: TutorialEnrolmentModalData) {
    let dialogRef: MatDialogRef<TutorialEnrolmentModalComponent, TutorialEnrolmentModalData>;

    dialogRef = this.dialog.open(TutorialEnrolmentModalComponent, {data});

    dialogRef.afterOpened().subscribe((result: any) => {});

    dialogRef.afterClosed().subscribe((result: any) => {});
  }
}
