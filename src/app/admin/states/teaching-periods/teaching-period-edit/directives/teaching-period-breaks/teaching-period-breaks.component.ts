import { Component, Input, Inject } from '@angular/core';

@Component({
  selector: 'teaching-period-breaks',
  templateUrl: 'teaching-period-breaks.component.html',
})
export class TeachingPeriodBreaksComponent {
  constructor() {}

  @Input() teachingperiod: any;
}
