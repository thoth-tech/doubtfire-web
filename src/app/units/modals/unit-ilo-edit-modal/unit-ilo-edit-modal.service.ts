/* eslint-disable @typescript-eslint/no-explicit-any */
import {Injectable} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {UnitILOEditModalComponent} from './unit-ilo-edit-modal.component';

@Injectable({
  providedIn: 'root',
})
export class UnitILOEditModalService {
  constructor(private dialog: MatDialog) {}

  show(unit: any, ilo?: any): void {
    this.dialog.open(UnitILOEditModalComponent, {
      data: {unit, ilo},
      width: '600px',
      panelClass: 'unit-ilo-edit-modal',
    });
  }
}
