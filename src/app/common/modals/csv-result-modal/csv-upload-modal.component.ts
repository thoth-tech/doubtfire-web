import {Component, Inject} from '@angular/core';
import {MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';

@Component({
  selector: 'app-csv-upload-modal',
  templateUrl: './csv-upload-modal.component.html',
  styleUrls: ['./csv-upload-modal.component.scss'],
})
export class CsvUploadModalComponent {
  title: string;
  message: string;
  batchFiles: any[];
  url: string;
  onSuccess: (response: any) => void;

  constructor(
    public dialogRef: MatDialogRef<CsvUploadModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    this.title = data.title;
    this.message = data.message;
    this.batchFiles = data.batchFiles;
    this.url = data.url;
    this.onSuccess = data.onSuccess;
  }

  wrapSuccess(response: any): void {
    this.dialogRef.close();
    this.onSuccess(response);
  }

  close(): void {
    this.dialogRef.close();
  }
}
