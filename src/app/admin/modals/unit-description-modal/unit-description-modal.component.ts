import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { UnitDescriptionModalContentComponent } from './unit-description-modal-content.component';
import { UnitDefinition } from 'src/app/api/models/unit-definition'; // Adjust path if needed

@Component({
  selector: 'unit-description-modal',
  template: '',
})
export class UnitDescriptionModal {
  constructor(private dialog: MatDialog) {}

  public show(unit: UnitDefinition): void {
    this.dialog.open(UnitDescriptionModalContentComponent, {
      width: '500px',
      data: unit,
    });
  }
}
