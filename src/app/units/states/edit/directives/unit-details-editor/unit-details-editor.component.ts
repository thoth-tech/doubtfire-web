import { Component, Input, Inject, NgModule } from '@angular/core';
import { TaskSubmissionService } from 'src/app/common/services/task-submission.service';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';
import { TeachingPeriodService } from 'src/app/api/services/teaching-period.service';
import { Unit } from 'src/app/api/models/unit';
import { UnitService } from 'src/app/api/services/unit.service';
import { TaskDefinition } from 'src/app/api/models/task-definition';
import { Task } from 'src/app/api/models/task';
import { CommonModule } from '@angular/common';  
import { BrowserModule } from '@angular/platform-browser';
import { MatSelect, MatFormField, MatSelectModule, } from '@angular/material/select';
import { MatDatepicker } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import { NgForm } from '@angular/forms';
import { AlertService } from 'src/app/common/services/alert.service';


@Component({
  selector: 'unit-details-editor',
  templateUrl: 'unit-details-editor.component.html',
  styleUrls: ['unit-details-editor.component.scss'],

})

export class UnitDetailsEditorComponent {
  submitForms(forms: NgForm[]) {
    forms.forEach(form => {
      if (form.valid) {
        console.log('Submitting form:', form);
        // Perform form submission logic
      }
    });
  }
  
  private images: any;
  @Input() unit: Unit;
  isSelectOpen = false;
  datepickers: MatDatepicker<any>[] = [];



  teachingPeriods: any[] = [];
  teachingPeriodValues: { value: any, text: string }[] = [{ value: undefined, text: "None" }];
  taskDefinitionValues: any[] = [];
  selectedTeachingPeriod: { value: any, text: string };

  private calOptions = {
    startOpened: false,
    endOpened: false,
    portfolioAUtoGenerationOpened: false,
  }


  constructor(
    private taskSubmission: TaskSubmissionService,
    private teachingPeriodService: TeachingPeriodService,
    private doubtFireConstants: DoubtfireConstants,  
    private unitService: UnitService,
    private alertService: AlertService,





  ) {}

  ngOnInit(): void {

    this.loadTeachingPeriods();
    this.unit.taskDefinitionCache.values.subscribe((taskDefs) => {
      this.taskDefinitionValues = [{value: undefined, text: "None"}]
      }
    )
  }

  private loadTeachingPeriods(): void {
    this.teachingPeriodService.query().subscribe(periods => {
      this.teachingPeriods = periods;
      this.teachingPeriodValues = [{ value: undefined, text: "None" }];
      this.teachingPeriodValues.push(...periods.map(p => ({ value: p, text: `${p.year} ${p.period}` })));
    });
    console.log(this.teachingPeriodValues);
  }

  teachingPeriodSelected(event) {
    this.unit.teachingPeriod = event;
  }

  draftTaskDefSelected(event) {
    this.unit.draftTaskDefinition = event;
  }

  open(event: MouseEvent, datePicker: MatDatepicker<any>) {
    event.preventDefault();
    event.stopPropagation();
  
    // Close all datepickers except the one being opened
    this.datepickers.forEach((dp) => {
      if (dp != datePicker) {
        dp.close();
      }
    });
  
    datePicker.open();
  }

  dateOptions = {
    formatYear: 'yy',
    startingDay: 1
  }

  saveUnit() {
    this.unitService.update(this.unit).subscribe()
    this.alertService.success("Unit updated", 3000);
    this.alertService.success("Failed to update unit.", 6000);
  }
 
 

}