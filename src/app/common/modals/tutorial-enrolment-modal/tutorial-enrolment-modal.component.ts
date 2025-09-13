import {Component, Inject, LOCALE_ID} from '@angular/core';
import {MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import {
  TaskComment,
  TaskCommentService,
  Task,
  Unit,
  Tutorial,
} from 'src/app/api/models/doubtfire-model';
import {AppInjector} from 'src/app/app-injector';
import {FormControl, Validators, FormGroup, FormGroupDirective, NgForm} from '@angular/forms';
import {ErrorStateMatcher} from '@angular/material/core';
import {AlertService} from '../../services/alert.service';

export interface TutorialEnrolmentModalData {
  task: Task;
}

@Component({
  selector: 'f-tutorial-enrolment-modal',
  templateUrl: './tutorial-enrolment-modal.component.html',
})
export class TutorialEnrolmentModalComponent {
  tutorialsFormControl = new FormControl<Tutorial | null>(null);

  constructor(
    public dialogRef: MatDialogRef<TutorialEnrolmentModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TutorialEnrolmentModalData,
    private alerts: AlertService,
  ) {}

  public getTutorialsForStream() {
    const tutorialStreamAbbreviation =
      this.data.task.definition.tutorialSelfEnrolmentStream.abbreviation;

    const student = this.data.task.project;
    return this.data.task.unit.tutorials.filter((tutorial) => {
      // Filter workshops based on campus allocation
      const result: boolean =
        student.campus == null ||
        tutorial.campus == null ||
        student.campus.id === tutorial.campus.id;

      if (!result) return result;
      if (tutorial.tutorialStream) {
        return tutorial.tutorialStream.abbreviation === tutorialStreamAbbreviation;
      }
    });
  }

  attemptTutorialEnrolment() {
    const selectedTutorial = this.tutorialsFormControl.value;
    this.data.task.project.switchToTutorial(selectedTutorial);
  }
}
