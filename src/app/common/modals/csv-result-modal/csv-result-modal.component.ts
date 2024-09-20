/* eslint-disable @typescript-eslint/no-explicit-any */
import {Component, Inject, OnInit} from '@angular/core';
import {MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'csv-result-modal',
  templateUrl: './csv-result-modal.component.html',
  styleUrls: ['./csv-result-modal.component.scss'],
})
export class CsvResultModalComponent implements OnInit {
  title: string;
  response: any;

  currentPage = 1;
  maxSize = 5;
  pageSize = 5;
  activeCsvResponseSelection: string;

  constructor(
    public dialogRef: MatDialogRef<CsvResultModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    this.title = data.title;
    this.response = data.response;
  }

  ngOnInit(): void {
    if (this.response.errors.length > 0) {
      this.activeCsvResponseSelection = 'errors';
    } else if (this.response.success.length > 0) {
      this.activeCsvResponseSelection = 'success';
    } else {
      this.activeCsvResponseSelection = 'ignored';
    }
  }

  itemData(selector: string): any[] {
    return this.response[selector];
  }

  close(): void {
    this.dialogRef.close();
  }
}
