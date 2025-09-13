import {Component, Input} from '@angular/core';
import {Task, User, UserService} from 'src/app/api/models/doubtfire-model';
import {TutorialEnrolmentModalService} from 'src/app/common/modals/tutorial-enrolment-modal/tutorial-enrolment-modal.service';

@Component({
  selector: 'f-task-tutorial-enrolment-card',
  templateUrl: './task-tutorial-enrolment-card.component.html',
  styleUrls: ['./task-tutorial-enrolment-card.component.scss'],
})
export class TaskTutorialEnrolmentCardComponent {
  @Input() task: Task;
  user: User;

  constructor(
    private userService: UserService,
    private tutorialEnrolmentModalService: TutorialEnrolmentModalService,
  ) {
    this.user = this.userService.currentUser;
  }

  isStudentEnrolledInTutorialStream(): boolean {
    const tutorialStreamAbbreviation =
      this.task.definition.tutorialSelfEnrolmentStream.abbreviation;
    let isEnrolledInTutorialStream = false;

    const studentTutorialEnrolments = this.task.project.tutorials;
    for (const tutorial of studentTutorialEnrolments) {
      if (tutorial.tutorialStream.abbreviation === tutorialStreamAbbreviation) {
        isEnrolledInTutorialStream = true;
      }
    }
    return isEnrolledInTutorialStream;
  }

  isNotStudent(): boolean {
    return this.user !== this.task.project.student;
  }

  launchTutorialEnrolment(): void {
    this.tutorialEnrolmentModalService.show({task: this.task});
  }
}
