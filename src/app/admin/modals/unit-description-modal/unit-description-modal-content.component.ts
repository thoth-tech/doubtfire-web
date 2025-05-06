import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { UnitDefinition } from 'src/app/api/models/unit-definition'; // Adjust path if needed

@Component({
  selector: 'unit-description-modal-content',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: 'unit-description-modal-content.component.html',
})
export class UnitDescriptionModalContentComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public unit: UnitDefinition) {}
}
