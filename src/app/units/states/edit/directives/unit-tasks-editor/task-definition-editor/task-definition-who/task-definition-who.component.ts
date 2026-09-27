import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {GroupSet, Tutorial} from 'src/app/api/models/doubtfire-model';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {Unit} from 'src/app/api/models/unit';

/** The select value for a task that each student submits on their own. */
export const INDIVIDUAL_SUBMISSION = 'individual';

@Component({
  selector: 'f-task-definition-who',
  templateUrl: 'task-definition-who.component.html',
  styleUrls: ['task-definition-who.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskDefinitionWhoComponent {
  @Input() taskDefinition: TaskDefinition;

  public readonly individualSubmission = INDIVIDUAL_SUBMISSION;
  public readonly collapsedTutorialCount = 3;

  showAllTutorials: boolean = false;
  public get unit(): Unit {
    return this.taskDefinition?.unit;
  }

  // The option for individual work used to have the string "null" as its value.
  // That string went into the task as its group set, so the task counted as group
  // work (isGroupTask only checks for null) and the select showed nothing picked.
  // A select cannot show a null option as picked either, so individual work gets
  // a named value here and is stored as null on the task.
  public get groupSetChoice(): GroupSet | typeof INDIVIDUAL_SUBMISSION {
    return this.taskDefinition?.groupSet ?? INDIVIDUAL_SUBMISSION;
  }

  public set groupSetChoice(value: GroupSet | typeof INDIVIDUAL_SUBMISSION) {
    this.taskDefinition.groupSet = value === INDIVIDUAL_SUBMISSION ? null : value;
  }

  public get relatedTutorials(): Tutorial[] {
    const unit = this.unit;
    return (unit && this.taskDefinition?.tutorialStream?.tutorialsIn(unit)) ?? [];
  }

  public get shownTutorials(): Tutorial[] {
    const tutorials = this.relatedTutorials;
    return this.showAllTutorials ? tutorials : tutorials.slice(0, this.collapsedTutorialCount);
  }

  onTutorialStreamChange() {
    this.showAllTutorials = false;
  }
}
