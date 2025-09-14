import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';
import { TeachingPeriod } from 'src/app/api/models/teaching-period';
import { Unit } from 'src/app/api/models/unit';
import { AlertService } from 'src/app/common/services/alert.service';
import { TeachingPeriodService as NewTeachingPeriodService } from 'src/app/api/services/teaching-period.service';

@Component({
  selector: 'f-unit-dates-selector',
  templateUrl: 'unit-dates-selector.component.html',
  styleUrls: ['unit-dates-selector.component.scss']
})
export class UnitDatesSelectorComponent implements OnInit {
  @Input() unit!: Unit;

  form: FormGroup;
  calOptions = {
    startOpened: false,
    endOpened: false
  };

  dateOptions = {
    formatYear: 'yy',
    startingDay: 1
  };

  teachingPeriodValues: { value: TeachingPeriod | undefined; text: string }[] = [];

  // External name is a BehaviorSubject
  externalName$ = this.doubtfireConstants.ExternalName;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private alertService: AlertService,
    private newTeachingPeriodService: NewTeachingPeriodService,
    private doubtfireConstants: DoubtfireConstants
  ) {
    this.form = this.fb.group({
      toPeriod: [null],
      startDate: [null],
      endDate: [null]
    });
  }

  ngOnInit(): void {
    this.newTeachingPeriodService.cache.values.subscribe((periods: TeachingPeriod[]) => {
      const now = Date.now();
      this.teachingPeriodValues = [{ value: undefined, text: 'None' }];

      const futurePeriods = periods
        .filter(tp => new Date(tp.endDate).getTime() > now)
        .map(tp => ({
          value: tp,
          text: `${tp.year} ${tp.period}`
        }));

      this.teachingPeriodValues.push(...futurePeriods);

      if (periods.length > 0) {
        this.form.patchValue({ toPeriod: periods[periods.length - 1] });
      }
    });
  }

  openPicker(picker: 'start' | 'end'): void {
    this.calOptions.startOpened = picker === 'start' ? !this.calOptions.startOpened : false;
    this.calOptions.endOpened = picker === 'end' ? !this.calOptions.endOpened : false;
  }

  saveUnit(): void {
    const { toPeriod, startDate, endDate } = this.form.value;

    const body: any = toPeriod
      ? { teaching_period_id: toPeriod.id }
      : { start_date: startDate, end_date: endDate };

    // Call model method directly (uses AppInjector internally)
    this.unit.rolloverTo(body).subscribe({
      next: (response: Unit) => {
        this.alertService.success('Unit created.', 2000);
        this.router.navigate(['/units/admin', response.id]);
      },
      error: (err: any) => {
        this.alertService.error(`Error creating unit - ${err}`);
      }
    });
  }
}
