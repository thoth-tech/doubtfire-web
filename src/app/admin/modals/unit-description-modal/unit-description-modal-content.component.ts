import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { UnitDefinition } from 'src/app/api/models/unit-definition';
import { RequirementService } from 'src/app/services/requirement.service';
import { Requirement } from 'src/app/api/models/requirement-definition';

@Component({
  selector: 'unit-description-modal-content',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: 'unit-description-modal-content.component.html',
})
export class UnitDescriptionModalContentComponent implements OnInit {
  requirements: Requirement[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public unit: UnitDefinition,
    private requirementService: RequirementService
  ) {}

  ngOnInit(): void {
    this.loadRequirements();
  }

  loadRequirements(): void {
    this.isLoading = true;
    this.requirementService.getByUnitId(this.unit.id).subscribe({
      next: (requirements) => {
        this.requirements = requirements;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading requirements:', error);
        this.errorMessage = 'Failed to load requirements. Please try again later.';
        this.isLoading = false;
      }
    });
  }
}
