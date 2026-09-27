import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class UnitTutorialsManagerComponent implements OnInit, OnDestroy {
  @Input() unit: Unit;

  activityTypes: ActivityType[] = new Array<ActivityType>();
  public loadingActivityTypes = true;

  private subscriptions: Subscription[] = [];

  constructor(
    private activityTypeService: ActivityTypeService,
    private alertService: AlertService,
  ) {}

  ngOnInit() {
    // Get the activity types
    this.subscriptions.push(
      this.activityTypeService.query().subscribe({
        next: (activityTypes) => {
          this.activityTypes = [...activityTypes];
          this.loadingActivityTypes = false;
        },
        error: () => {
          this.loadingActivityTypes = false;
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  /**
   * Tutorials from before streams existed have none. They were never shown on this tab,
   * so there was no way to see or change them here.
   */
  public get hasTutorialsWithoutStream(): boolean {
    return this.unit.tutorials.some((tutorial) => !tutorial.tutorialStream);
  }

  public get tutorialCount(): number {
    return this.unit.tutorials.length;
  }

  onClickNewActivity(activity: ActivityType) {
    this.unit.nextStream(activity.abbreviation).subscribe({
      next: (value: TutorialStream) => {
        this.alertService.success(`Added the ${value.name} stream`, 2000);
      },
      error: (message) => {
        this.alertService.error(`Could not add the stream. ${message}`, 8000);
      },
    });
  }
}
