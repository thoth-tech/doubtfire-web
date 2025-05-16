import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';
import { AlertService } from 'src/app/common/services/alert.service';
import { NewUnitService } from 'src/app/api/services/new-unit.service';
import { AnalyticsService } from 'src/app/common/services/analytics.service';

@Component({
  selector: 'create-unit-modal',
  templateUrl: 'create-unit-modal.component.html',
  styleUrls: ['create-unit-modal.component.scss'],
})
export class CreateUnitModalComponent implements OnInit {
  unit = { 
    code: null, 
    name: null 
  };
  
  units: any;
  externalName: any;

  constructor(
    private dialogRef: MatDialogRef<CreateUnitModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {units: any},
    private doubtfireConstants: DoubtfireConstants,
    private alertService: AlertService,
    private newUnitService: NewUnitService,
    private analyticsService: AnalyticsService
  ) {
    this.units = data.units;
  }

  ngOnInit(): void {
    this.analyticsService.event('Unit Admin', 'Started to Create Unit');
    this.externalName = this.doubtfireConstants.ExternalName;
  }

  saveUnit(): void {
    this.newUnitService.create({ unit: this.unit }).subscribe({
      next: (response) => {
        this.alertService.success('Unit created.', 2000);
        this.dialogRef.close();
      },
      error: (response) => {
        this.alertService.error(response, 6000);
      }
    });
  }
}