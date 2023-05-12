import { Component, Input, Inject } from '@angular/core';
import { alertService } from 'src/app/ajs-upgraded-providers';
import { TeachingPeriod } from 'src/app/api/models/doubtfire-model';
import { TeachingPeriodService } from 'src/app/api/services/teaching-period.service';

@Component({
  selector: 'teaching-period-details-editor',
  templateUrl: 'teaching-period-details-editor.component.html',
  styleUrls: ['teaching-period-details-editor.component.scss'],
})
export class TeachingPeriodDetailsEditorComponent {
  @Input() teachingperiod: TeachingPeriod;

  constructor(private teachingPeriodService: TeachingPeriodService, @Inject(alertService) private alerts: any) {}

  submit() {
    this.teachingPeriodService.update(this.teachingperiod).subscribe({
      next: (updatedTeachingPeriod) => {
        this.alerts.add('success', 'Teaching Period updated.', 2000);
      },
      error: (error) => {
        this.alerts.add('danger', `Failed to update teaching period. ${error}`, 6000);
      },
    });
  }
}
