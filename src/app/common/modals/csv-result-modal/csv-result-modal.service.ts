/* eslint-disable @typescript-eslint/no-explicit-any */
import {Injectable} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {CsvResultModalComponent} from './csv-result-modal.component';
import {AlertService} from '../../services/alert.service';

interface CsvResponse {
  errors: any[];
  success: any[];
}

@Injectable({
  providedIn: 'root',
})
export class CsvResultModalService {
  constructor(
    private dialog: MatDialog,
    private alertService: AlertService,
  ) {}

  public show(title: string, response: CsvResponse): void {
    // Ensure response objects are defined and valid
    const errorsLength = response.errors?.length ?? 0;
    const successLength = response.success?.length ?? 0;

    if (errorsLength === 0) {
      this.alertService.success(`Data uploaded. Success with ${successLength} items.`, 2000);
    } else if (successLength > 0) {
      this.alertService.message(
        `Data uploaded, success with ${successLength} items, but ${errorsLength} errors.`,
        6000,
      );
    } else {
      this.alertService.error(`Data uploaded but ${errorsLength} errors`, 6000);
    }

    // Open the modal dialog
    const dialogRef: MatDialogRef<CsvResultModalComponent, any> = this.dialog.open(
      CsvResultModalComponent,
      {
        data: {title, response},
        width: '600px',
        panelClass: 'csv-result-modal',
      },
    );
  }
}
