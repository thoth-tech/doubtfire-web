import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';
import { AlertService } from 'src/app/common/services/alert.service';
import { UnitService } from 'src/app/api/models/doubtfire-model';
import { analyticsService } from 'src/app/ajs-upgraded-providers';


@Component({
  selector: 'f-create-unit-modal',
  templateUrl: './create-unit-modal.component.html',
  styleUrls: ['./create-unit-modal.component.scss']
})
export class CreateUnitModalComponent {
  unitForm: FormGroup;
  externalName$ = this.constants.ExternalName;


 constructor(
  private dialogRef: MatDialogRef<CreateUnitModalComponent>,
  private fb: FormBuilder,
  private alertService: AlertService,
  private unitService: UnitService,
  @Inject(analyticsService) private analyticsService: any,
  private constants: DoubtfireConstants,
  @Inject(MAT_DIALOG_DATA) public units: any
) {
  this.unitForm = this.fb.group({
    name: [null, Validators.required],
    code: [null, Validators.required]
  });

  this.analyticsService.event('Unit Admin', 'Started to Create Unit');
}


  saveUnit(): void {
    if (this.unitForm.invalid) return;

    const unit = this.unitForm.value;
    this.unitService.create({ unit }).subscribe({
  next: () => {
    this.alertService.success('Unit created.', 2000);
    this.dialogRef.close();
  },
  error: (err) => {
    this.alertService.error(err, 6000);
  }
});

  }
}
