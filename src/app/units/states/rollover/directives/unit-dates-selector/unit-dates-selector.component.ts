import {Component, Input, OnInit} from '@angular/core';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {AlertService} from 'src/app/common/services/alert.service';
import {TeachingPeriodService} from 'src/app/api/services/teaching-period.service';
import {Unit} from 'src/app/api/models/unit';
import {UIRouter} from '@uirouter/angular';
import _ from 'lodash';

@Component({
  selector: 'f-unit-dates-selector',
  templateUrl: './unit-dates-selector.component.html',
  //styleUrls: ['./unit-dates-selector.component.scss'],
})
export class UnitDatesSelectorComponent implements OnInit {
  @Input() unit: Unit;
  externalName: string = '';
  teachingPeriods: any[] = [];
  teachingPeriodValues: {value: any; text: string}[] = [{value: undefined, text: 'None'}];
  saveData;

  constructor(
    private doubtfireConstants: DoubtfireConstants,
    private alertService: AlertService,
    private newTeachingPeriodService: TeachingPeriodService,
    private router: UIRouter,
  ) {}

  ngOnInit(): void {
    this.saveData = {
      id: this.unit.id,
      toPeriod: null,
      startDate: null,
      endDate: null,
    };
    this.externalName = this.doubtfireConstants.ExternalName.value;
    // Load teaching periods
    this.newTeachingPeriodService.cache.values.subscribe((periods) => {
      this.teachingPeriodValues = [{value: undefined, text: 'None'}];
      const other = periods
        .filter((tp) => tp.endDate.getTime() > Date.now())
        .map((p) => ({value: p, text: '#{p.year} #{p.period}'}));
      _.each(other, (d) => this.teachingPeriodValues.push(d));

      if (periods.length > 0) {
        this.saveData.toPeriod = periods[periods.length - 1];
      }
    });
  }
  compareFn(a, b): boolean {
    return (!a && !b) || a === b;
  }
  teachingPeriodSelected($event) {
    this.saveData.toPeriod = $event;
  }
  saveUnit() {
    let body;
    if (this.saveData.toPeriod) {
      body = {
        teaching_period_id: this.saveData.toPeriod.id,
      };
    } else {
      body = {
        start_date: this.saveData.startDate,
        end_date: this.saveData.endDate,
      };
    }
    this.unit.rolloverTo(body).subscribe({
      next: (response) => {
        this.alertService.success('Unit created.', 2000);
        this.router.stateService.go('units/admin', {unitId: response.id});
      },
      error: (response) => {
        this.alertService.error(`Failed to creating unit. ${response}`, 6000);
      },
    });
  }
}
