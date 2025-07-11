import { Component, Input, Inject } from '@angular/core'
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AlertService } from '../../services/alert.service';

export interface ConfirmationModalData {
  title: string;
  message: string;
  action: () => void;
}

@Component({
  selector: 'confirmation-modal',
  templateUrl: 'confirmation-modal.component.html',
  styleUrls: ['confirmation-modal.component.scss']
})
export class ConfirmationModalComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmationModalComponent>,
    private alertService: AlertService,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmationModalData
  ) {}

  confirm(): void {
    this.data.action();
    this.dialogRef.close();
  }

  cancel(): void {
    this.dialogRef.close({ cancelled: true });
    this.alertService.message(`${this.data.title} action cancelled`, 3000)
  }
}
