import {Injectable} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {CsvUploadModalComponent} from './csv-upload-modal.component';

@Injectable({
  providedIn: 'root',
})
export class CsvUploadModalService {
  constructor(private dialog: MatDialog) {}

  public show(
    title: string,
    message: string,
    batchFiles: any[],
    url: string,
    onSuccess: (response: any) => void,
  ): void {
    //const dialogRef: MatDialogRef<CsvUploadModalComponent, any>;
    //dialogRef = this.dialog.open(CsvUploadModalComponent, {
    this.dialog.open(CsvUploadModalComponent, {
      data: {title, message, batchFiles, url, onSuccess},
      width: '600px',
      panelClass: 'csv-upload-modal',
    });
  }
}
