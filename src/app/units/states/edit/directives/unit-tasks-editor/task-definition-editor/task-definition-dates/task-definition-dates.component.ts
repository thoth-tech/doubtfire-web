import {startOfDay} from 'date-fns';
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {AbstractControl} from '@angular/forms';
import {ErrorStateMatcher} from '@angular/material/core';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {Unit} from 'src/app/api/models/unit';

function isDayBefore(date: Date | null | undefined, other: Date | null | undefined): boolean {
  if (!date || !other) {
    return false;
  }
  return startOfDay(date).getTime() < startOfDay(other).getTime();
}

// Material's own rule, a touched field that fails a validator, plus one extra
// condition. Made once per field, because Material asks it on every check.
function matcherWith(extraError: () => boolean): ErrorStateMatcher {
  return {
    isErrorState: (control: AbstractControl | null) =>
      (!!control?.invalid && !!control?.touched) || extraError(),
  };
}

@Component({
  selector: 'f-task-definition-dates',
  templateUrl: 'task-definition-dates.component.html',
  styleUrls: ['task-definition-dates.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskDefinitionDatesComponent {
  @Input() taskDefinition: TaskDefinition;

  public readonly targetDateMatcher = matcherWith(() => this.isTargetBeforeStart);
  public readonly finalDateMatcher = matcherWith(() => this.isFinalBeforeTarget);

  public get unit(): Unit {
    return this.taskDefinition?.unit;
  }

  public get isTargetBeforeStart(): boolean {
    return isDayBefore(this.taskDefinition?.targetDate, this.taskDefinition?.startDate);
  }

  public get isFinalBeforeTarget(): boolean {
    return isDayBefore(this.taskDefinition?.dueDate, this.taskDefinition?.targetDate);
  }
}
