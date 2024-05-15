import { Component, Input, Inject, NgModule } from '@angular/core';
import { TaskSubmissionService } from 'src/app/common/services/task-submission.service';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';
import { TeachingPeriodService } from 'src/app/api/services/teaching-period.service';
import { Unit } from 'src/app/api/models/unit';
import { UnitService } from 'src/app/api/services/unit.service';
import { BrowserModule } from '@angular/platform-browser';
import { MatDatepicker } from '@angular/material/datepicker';
import { NgForm } from '@angular/forms';
import { AlertService } from 'src/app/common/services/alert.service';
import { UIRouter } from '@uirouter/angular';

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
  declarations: [
    UnitDetailsEditorComponent
  ]

  imports: [
    BrowserModule,
  ]
  
  
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
    @Inject(UIRouter) private router: UIRouter



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
    this.unitService.update(this.unit).subscribe();
    console.log("update button pressed");
    this.alertService.success("Unit updated", 3000);
    this.alertService.error("Unit failed to update", 5000);
  }

  
  navigateToRolloverPage() {
    this.router.stateService.go('units/rollover');
  }

}