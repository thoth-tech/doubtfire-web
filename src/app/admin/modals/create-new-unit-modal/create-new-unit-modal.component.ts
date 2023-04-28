import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CreateNewUnitModalContentComponent } from './create-new-unit-modal-content.component';

@Component({
  selector: 'create-new-unit-modal',
  template: '',
})
export class CreateNewUnitModalComponent {
  constructor(public dialog: MatDialog) {}
  public show(): void {
    this.dialog.open(CreateNewUnitModalContentComponent, {
      width: '500px',
    });
  }
}
