import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatDialogRef, MatDialogModule} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';

@Component({
  selector: 'f-overload-warning-dialog',
  templateUrl: './overload-warning-dialog.component.html',
  styleUrls: ['./overload-warning-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
})
export class OverloadWarningDialogComponent {
  constructor(public dialogRef: MatDialogRef<OverloadWarningDialogComponent>) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onOk(): void {
    this.dialogRef.close(true);
  }
}
