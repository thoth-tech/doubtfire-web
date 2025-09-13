import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {Task, User, UserService} from 'src/app/api/models/doubtfire-model';

@Component({
  selector: 'f-task-tutorial-enrolment-card',
  templateUrl: './task-tutorial-enrolment-card.component.html',
  styleUrls: ['./task-tutorial-enrolment-card.component.scss'],
})
export class TaskTutorialEnrolmentCardComponent implements OnChanges {
  @Input() task: Task;
  user: User;
  isSubmitted: boolean; // task submitted and student enrolled in tutorial
  tutorialEnrolmentEnabled: boolean;

  constructor(private userService: UserService) {
    this.user = this.userService.currentUser;
    this.tutorialEnrolmentEnabled = true; // debug
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      changes.task &&
      changes.task.currentValue &&
      changes.task.currentValue.definition.tutorialSelfEnrolmentEnabled
    ) {
      console.log('self enrolment feature is enabled for this task'); // debug
    }
  }

  isNotStudent(): boolean {
    return this.user !== this.task.project.student;
  }

  launchTutorialEnrolment(): void {
    console.log('launching tutorial enrolment...'); // debug
  }
}