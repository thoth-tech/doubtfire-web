// create-unit-modal.service.ts
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CreateUnitModalComponent } from './create-unit-modal.component';

@Injectable({
  providedIn: 'root'
})
export class CreateUnitModalService {
  constructor(private dialog: MatDialog) {}

  show(units: any): void {
    this.dialog.open(CreateUnitModalComponent, {
      width: '500px',
      data: { units: units }
    });
  }
}