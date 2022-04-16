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
  
  newTask: { getSubmissionDetails: () => void; }
  
  constructor() {
    this.notSubmitted = (task: { has_pdf: any; processing_pdf: any; }) => !task.has_pdf && (!task.processing_pdf);

    this.loadingDetails = (task: { needsSubmissionDetails: () => any; }) => task.needsSubmissionDetails();

      
    if (this.newTask == null) { return; }
      this.newTask.getSubmissionDetails();
      this.taskUrl = this.TaskFeedback.getTaskUrl(this.newTask);
      return this.taskFilesURL = this.TaskFeedback.getTaskFilesUrl(this.newTask);
    }
}

/*
angular.module('doubtfire.tasks.task-submission-viewer', [])

#
# Viewer for an uploaded task submission
#
.directive('taskSubmissionViewer', ->
  restrict: 'E'
  templateUrl: 'tasks/task-submission-viewer/task-submission-viewer.tpl.html'
  scope:
    project: "=project"
    task: "=task"
  controller: ($scope, TaskFeedback) ->
    $scope.notSubmitted = (task) ->
      not task.has_pdf and (not task.processing_pdf)

    $scope.loadingDetails = (task) ->
      task.needsSubmissionDetails()

    $scope.$watch 'task', (newTask) ->
      return unless newTask?
      newTask.getSubmissionDetails()
      $scope.taskUrl = TaskFeedback.getTaskUrl newTask
      $scope.taskFilesURL = TaskFeedback.getTaskFilesUrl newTask
)
*/
