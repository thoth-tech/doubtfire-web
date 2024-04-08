import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { alertService } from 'src/app/ajs-upgraded-providers';
import { LearningOutcome } from 'src/app/api/models/learning-outcome';
import { Unit } from 'src/app/api/models/unit';
import { LearningOutcomeService } from 'src/app/api/services/learning-outcome.service';
import { AppInjector } from 'src/app/app-injector';

@Component({
  selector: 'unit-ilo-edit-modal',
  templateUrl: 'unit-ilo-edit-modal.component.html',
  styleUrls: ['unit-ilo-edit-modal.component.scss'],
})
export class UnitILOEditModalComponent implements OnInit {
  public isNew: boolean;
  public unit: Unit;
  public ilo: LearningOutcome;
  public iloNum: number = 0;
  public editedName: string = '';
  public editedAbbreviation: string = '';
  public editedDescription: string = '';

  constructor(
    public dialogRef: MatDialogRef<UnitILOEditModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {unit: Unit; ilo: LearningOutcome},
    @Inject(alertService) private alerts: any,
  ) {}

  ngOnInit() {
    this.isNew = this.data.ilo == null;
    this.unit = this.data.unit;
    this.ilo = this.data.ilo;

    if (this.isNew) {
      this.ilo = new LearningOutcome();
    } else {
      this.iloNum = this.ilo.iloNumber;
      this.editedName = this.ilo.name;
      this.editedAbbreviation = this.ilo.abbreviation;
      this.editedDescription = this.ilo.description;
    }
  }

  submitILO() {
    const learningOutcomeService: LearningOutcomeService = AppInjector.get(LearningOutcomeService);

    this.ilo.name = this.editedName;
    this.ilo.abbreviation = this.editedAbbreviation;
    this.ilo.description = this.editedDescription;

    if (this.isNew) {
      learningOutcomeService
        .create(
          {
            unitId: this.unit.id,
          },
          {
            body: {
              name: this.ilo.name,
              description: this.ilo.description,
              abbreviation: this.ilo.abbreviation,
            },
            cache: this.unit.learningOutcomesCache,
          },
        )
        .subscribe({
          next: () => {
            this.alerts.add('success', 'Intended Learning Outcome Added', 2000);
          },
          error: (response) => {
            this.alerts.add('danger', response, 6000);
          },
        });
    } else {
      learningOutcomeService
        .update({unitId: this.unit.id, id: this.ilo.id}, {entity: this.ilo})
        .subscribe({
          next: () => {
            this.alerts.add('success', 'Intended Learning Outcome Updated', 2000);
          },
          error: (response) => {
            this.alerts.add('danger', response, 6000);
          },
        });
    }
  }
}
