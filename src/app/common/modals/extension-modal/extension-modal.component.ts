import { Component, OnInit, Inject, LOCALE_ID } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { alertService } from 'src/app/ajs-upgraded-providers';
import { ExtensionComment } from 'src/app/api/models/task-comment/extension-comment';
import { TaskComment, TaskCommentService, Task } from 'src/app/api/models/doubtfire-model';
import { AppInjector } from 'src/app/app-injector';
import { formatDate } from '@angular/common';

@Component({
  selector: 'extension-modal',
  templateUrl: './extension-modal.component.html',
  styleUrls: ['./extension-modal.component.scss'],
})
export class ExtensionModalComponent implements OnInit {
  daysRequested: number;
  reason: string = '';
  constructor(
    public dialogRef: MatDialogRef<ExtensionModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {task: Task, afterApplication?: () => void},
    @Inject(alertService) private alerts: any
  ) {}

  ngOnInit() {
    this.daysRequested = this.minDaysCanExtend + 1;
    if (this.daysRequested > this.maxDaysCanExtend) {
      this.daysRequested = this.maxDaysCanExtend;
    }
  }

  get newDueDate() {
    const calculatedDueDate = new Date(this.data.task.localDueDate().getTime() + this.daysRequested * 1000 * 60 * 60 * 24 );
    const taskDeadlineDate: Date = this.data.task.definition.localDeadlineDate();

    const locale: string = AppInjector.get(LOCALE_ID);

    if (calculatedDueDate > taskDeadlineDate) {
      return formatDate(taskDeadlineDate, 'dd MMMM', locale);
    } else {
      return formatDate(calculatedDueDate, 'dd MMMM', locale);
    }
  }

  get maxDaysCanExtend() {
    return this.data.task.maxDaysCanExtend();
  }

  get minDaysCanExtend() {
    return this.data.task.minDaysCanExtend();
  }

  private scrollCommentsDown(): void {
    setTimeout(() => {
      const objDiv = document.querySelector('div.comments-body');
      // let wrappedResult = angular.element(objDiv);
      objDiv.scrollTop = objDiv.scrollHeight;
    }, 50);
  }

  submitApplication() {
    const tcs: TaskCommentService = AppInjector.get(TaskCommentService);

    tcs.requestExtension(this.reason, this.daysRequested, this.data.task).subscribe({
      next: ((tc: TaskComment) => {
        this.alerts.add('success', 'Extension requested.', 2000);
        this.scrollCommentsDown();
        if (typeof this.data.afterApplication === 'function') {
          this.data.afterApplication();
        }
      }).bind(this),

      error: ((response: any) => {
        this.alerts.add('danger', 'Error requesting extension ' + response);
      }).bind(this),
    });
  }
}
