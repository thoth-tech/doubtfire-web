import {Component, Inject, Input} from '@angular/core';
import {
  ActivityType,
  ActivityTypeService,
  TutorialStream,
  Unit,
} from 'src/app/api/models/doubtfire-model';
import {AlertService} from 'src/app/common/services/alert.service';

@Component({
  selector: 'unit-tutorials-manager',
  templateUrl: 'unit-tutorials-manager.component.html',
  styleUrls: ['unit-tutorials-manager.component.scss'],
})
export class UnitTutorialsManagerComponent {
  @Input() unit: Unit;

  activityTypes: ActivityType[] = new Array<ActivityType>();
  tutorialsByStream: any[] = new Array<any>();

  constructor(
    private activityTypeService: ActivityTypeService,
    private alertService: AlertService,
  ) {}

  ngOnInit() {
    // Get the activity types
    this.activityTypeService.query().subscribe((activityTypes) => {
      this.activityTypes.push(...activityTypes);
    });
  }

  onClickNewActivity(activity: ActivityType) {
    this.unit.nextStream(activity.abbreviation).subscribe({
      next: (value: TutorialStream) => {
        this.alertService.success(`Added tutorial stream ${value.abbreviation}`, 2000);
      },
      error: (message) => {
        this.alertService.error(`Error creating tutorial stream: ${message}`, 8000);
      },
    });
  }
}
