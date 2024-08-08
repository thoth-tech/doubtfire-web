import {Injectable} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {CsvResultModalComponent} from './csv-result-modal.component';
import {AlertService} from '../../services/alert.service';

@Injectable({
  providedIn: 'root',
})
export class CsvResultModalService {
  constructor(
    private dialog: MatDialog,
    private alertService: AlertService,
  ) {}

  public show(title: string, response: any): void {
    if (response.errors.length === 0) {
      this.alertService.success(
        `Data uploaded. Success with ${response.success.length} items.`,
        2000,
      );
    } else if (response.success.length > 0) {
      this.alertService.message(
        `Data uploaded, success with ${response.success.length} items, but ${response.errors.length} errors.`,
        6000,
      );
    } else {
      this.alertService.error(`Data uploaded but ${response.errors.length} errors`, 6000);
    }

    //const dialogRef: MatDialogRef<CsvResultModalComponent, any> = null;
    //dialogRef = this.dialog.open(CsvResultModalComponent, {
    this.dialog.open(CsvResultModalComponent, {
      data: {title, response},
      width: '600px',
      panelClass: 'csv-result-modal',
    });
  }
}
