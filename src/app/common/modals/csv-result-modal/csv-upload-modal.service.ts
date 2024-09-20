/* eslint-disable @typescript-eslint/no-explicit-any */
import {Injectable} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {CsvUploadModalComponent} from './csv-upload-modal.component';

export interface BatchFile {
  file: File;
}

export interface File {
  name: string;
  size?: number;
  type?: string;
}

interface Response {
  success: boolean;
  data: any;
  errors?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class CsvUploadModalService {
  constructor(private dialog: MatDialog) {}

  public show(
    title: string,
    message: string,
    batchFiles: any,
    url: string,
    onSuccess: (response: Response) => void,
  ): void {
    const validBatchFiles: BatchFile[] = batchFiles ?? [];

    const dialogRef: MatDialogRef<CsvUploadModalComponent, any> = this.dialog.open(
      CsvUploadModalComponent,
      {
        data: {title, message, batchFiles: validBatchFiles, url, onSuccess},
        width: '600px',
        panelClass: 'csv-upload-modal',
      },
    );
  }
}
