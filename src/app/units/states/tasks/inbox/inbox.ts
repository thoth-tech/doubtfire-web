import {StateProvider} from '@uirouter/angularjs';
import * as angular from 'angular';
import {IScope} from 'angular';
import {TaskService} from 'src/app/api/services/task.service';

interface ITaskScope extends IScope {
  taskData: {
    source: typeof TaskService.prototype.queryTasksForTaskInbox;
    taskDefMode: boolean;
  };
}

angular
  .module('doubtfire.units.states.tasks.inbox', [])

  .config([
    '$stateProvider',
    ($stateProvider: StateProvider) => {
      $stateProvider.state('units/tasks/inbox', {
        parent: 'units/tasks',
        url: '/inbox/{taskKey:any}',
        templateUrl: 'units/states/tasks/inbox/inbox.html', // updated from .tpl.html
        controller: 'TaskInboxStateCtrl',
        params: {
          taskKey: {dynamic: true},
        },
        data: {
          task: 'Task Inbox',
          pageTitle: '_Home_',
          roleWhitelist: ['Tutor', 'Convenor', 'Admin', 'Auditor'], // (removed duplicate 'Auditor')
        },
      });
    },
  ])

  .controller('TaskInboxStateCtrl', [
    '$scope',
    'newTaskService',
    ($scope: ITaskScope, newTaskService: TaskService) => {
      $scope.taskData = $scope.taskData || {
        source: newTaskService.queryTasksForTaskInbox.bind(newTaskService),
        taskDefMode: false,
      };
    },
  ]);
