import { Component, Input } from '@angular/core';


@Component({
  selector: 'task-submission-viewer',
  templateUrl: './task-submission-viewer.component.html',
  styleUrls: ['task-submission-viewer.component.scss'],
  
})
export class TaskSubmissionViewerComponent {
  @Input() task: any;
  @Input() notSubmitted: (task: any) => boolean;
  @Input() loadingDetails: (task: any) => any;
  @Input() taskUrl: any;
  @Input() taskFilesURL: any;
  @Input() TaskFeedback: { getTaskUrl: (arg0: any) => any; getTaskFilesUrl: (arg0: any) => any; }
  
  newTask: { getSubmissionDetails: () => void; } //newTask property to store submission details
  
  constructor() {
    this.notSubmitted = (task: { has_pdf: any; processing_pdf: any; }) => !task.has_pdf && (!task.processing_pdf); //notSubmitted property detects if task has pdf or is processing pdf.

    this.loadingDetails = (task: { needsSubmissionDetails: () => any; }) => task.needsSubmissionDetails(); //loadingDetails property calls for submission details if task has none.

      
    if (this.newTask == null) { return; } //if newTask is called then fill, else return.
      this.newTask.getSubmissionDetails();
      this.taskUrl = this.TaskFeedback.getTaskUrl(this.newTask);
      return this.taskFilesURL = this.TaskFeedback.getTaskFilesUrl(this.newTask);
    }
}