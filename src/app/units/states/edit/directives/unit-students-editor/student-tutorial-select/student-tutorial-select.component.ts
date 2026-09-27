import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {MatOptionSelectionChange} from '@angular/material/core';
import {Project, Tutorial, TutorialStream, Unit} from 'src/app/api/models/doubtfire-model';

@Component({
  selector: 'student-tutorial-select',
  templateUrl: 'student-tutorial-select.component.html',
  styleUrls: ['student-tutorial-select.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class StudentTutorialSelectComponent {
  @Input() unit: Unit;
  @Input() student: Project;

  /**
   * Compare a tutorial with an enrolment
   *
   * @param aEntity The tutorial itself
   * @param bEntity The tutorial enrolment
   */
  compareSelection(aEntity: Tutorial, bEntity: Tutorial): boolean {
    if (!aEntity || !bEntity) {
      return false;
    }
    return aEntity.id === bEntity.id;
  }

  /**
   * Move the student when they pick a tutorial. This listens for the option's own
   * selection rather than a click, so choosing with the keyboard works too. Changes
   * that come from the list being redrawn are not the user's, and are ignored.
   */
  public tutorialPicked(event: MatOptionSelectionChange, tutorial: Tutorial): void {
    if (event.isUserInput) {
      this.student.switchToTutorial(tutorial);
    }
  }

  public tutorialsForStreamAndStudent(student: Project, stream?: TutorialStream) {
    return (this.unit?.tutorials ?? []).filter((tutorial) => {
      const result: boolean =
        student.campus == null ||
        tutorial.campus == null ||
        student.campus.id === tutorial.campus.id;
      if (!result) {
        return result;
      }
      if (tutorial.tutorialStream && stream) {
        return tutorial.tutorialStream.abbreviation === stream.abbreviation;
      } else if (!tutorial.tutorialStream && !stream) {
        return true;
      } else {
        return false;
      }
    });
  }
}
