import { Component, OnInit } from '@angular/core';
import { DoubtfireConstants } from 'src/app/constants/doubtfire.constants';
import { AlertService } from 'src/app/services/alert.service';
import { NewTeachingPeriodService } from 'src/app/services/new-teaching-period.service';
import { Router } from '@angular/router';
import { TeachingPeriod } from 'src/app/models/teaching-period.model';

@Component({
  selector: 'app-unit-dates-selector',
  templateUrl: './unit-dates-selector.component.html',
  styleUrls: ['./unit-dates-selector.component.css']
})
export class UnitDatesSelectorComponent implements OnInit {
  calOptions = {
    startOpened: false,
    endOpened: false
  };
  externalName: string;
  teachingPeriodValues: { value: TeachingPeriod, text: string }[] = [];
  saveData = {
    id: null,
    toPeriod: null,
    startDate: null,
    endDate: null
  };

  constructor(
    private router: Router,
    private alertService: AlertService,
    private newTeachingPeriodService: NewTeachingPeriodService,
    private doubtfireConstants: DoubtfireConstants
  ) {}

  ngOnInit(): void {
    this.externalName = this.doubtfireConstants.ExternalName;

    // Get the teaching periods
    this.newTeachingPeriodService.cache.values.subscribe((periods) => {
      this.teachingPeriodValues = [{ value: undefined, text: "None" }];
      const other = periods
        .filter((tp) => tp.endDate > Date.now())
        .map((p) => ({ value: p, text: `${p.year} ${p.period}` }));

      other.forEach((d) => this.teachingPeriodValues.push(d));

      if (periods.length > 0) {
        this.saveData.toPeriod = periods[periods.length - 1];
      }
    });
  }

  teachingPeriodSelected(event: any): void {
    this.saveData.toPeriod = event;
  }

  open(event: any, pickerData: string): void {
    event.preventDefault();
    event.stopPropagation();

    if (pickerData === 'start') {
      this.calOptions.startOpened = !this.calOptions.startOpened;
      this.calOptions.endOpened = false;
    } else {
      this.calOptions.startOpened = false;
      this.calOptions.endOpened = !this.calOptions.endOpened;
    }
  }

  saveUnit(): void {
    const body = this.saveData.toPeriod
      ? { teaching_period_id: this.saveData.toPeriod.id }
      : { start_date: this.saveData.startDate, end_date: this.saveData.endDate };

    this.saveData.id; // Use the unit id from wherever needed (e.g., from route params or elsewhere).

    // Call rollover service (not implemented here)
    this.unitRolloverService(body).subscribe({
      next: (response) => {
        this.alertService.success('Unit created.', 2000);
        this.router.navigate(['units/admin'], { queryParams: { unitId: response.id } });
      },
      error: (response) => {
        this.alertService.error(`Error creating unit - ${response}`);
      }
    });
  }

  // Placeholder method for the unit rollover service (replace with actual service call)
  unitRolloverService(body: any) {
    return {
      subscribe: (callbacks: any) => {
        // Mock response
        setTimeout(() => callbacks.next({ id: 123 }), 1000);
      }
    };
  }
}
