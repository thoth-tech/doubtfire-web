/* eslint-disable @angular-eslint/component-selector */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {LearningOutcomeService} from 'src/app/api/services/learning-outcome.service';
import {AlertService} from 'src/app/common/services/alert.service';

@Component({
  selector: 'unit-ilo-edit-modal',
  templateUrl: 'unit-ilo-edit-modal.component.html',
  styleUrls: ['unit-ilo-edit-modal.component.scss'],
})
export class UnitILOEditModalComponent {
  prototypeIlo = {name: null, description: null, abbreviation: null};
  ilo: any;
  isNew: boolean;

  constructor(
    public dialogRef: MatDialogRef<UnitILOEditModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private alertService: AlertService,
    private newLearningOutcomeService: LearningOutcomeService,
  ) {
    this.ilo = data.ilo || this.prototypeIlo;
    this.isNew = !data.ilo;
  }

  saveILO(): void {
    if (this.isNew) {
      this.newLearningOutcomeService
        .create(
          {
            unitId: this.data.unit.id,
          },
          {
            body: {
              name: this.ilo.name,
              description: this.ilo.description,
              abbreviation: this.ilo.abbreviation,
            },
            cache: this.data.unit.learningOutcomesCache,
          },
        )
        .subscribe({
          next: (response) => {
            this.dialogRef.close(response);
            this.alertService.success('Intended Learning Outcome Added', 2000);
          },
          error: (response) => {
            this.alertService.error(response, 6000);
          },
        });
    } else {
      this.newLearningOutcomeService
        .update(
          {
            unitId: this.data.unit.id,
            id: this.ilo.id,
          },
          {
            entity: this.ilo,
          },
        )
        .subscribe({
          next: (response) => {
            this.dialogRef.close(response);
            this.alertService.success('Intended Learning Outcome Updated', 2000);
          },
          error: (response) => {
            this.alertService.error(response, 6000);
          },
        });
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
