angular.module('doubtfire.units.states.tasks.definition', [])

#
# Mark tasks by task definition ID
#
.config(($stateProvider) ->
  $stateProvider.state 'units/tasks/definition', {
    parent: 'units/tasks'
    url: '/definition/{taskKey:any}'

    # Reuse the inbox UI directly (controller handles definition-specific behaviour)
    templateUrl: "units/states/tasks/inbox/inbox.tpl.html"
    controller: "TaskDefinitionStateCtrl"

    params:
      taskKey: dynamic: true

    data:
      task: "Task Explorer"
      pageTitle: "_Home_"
      roleWhitelist: ['Tutor', 'Convenor', 'Admin', 'Auditor']
  }
)

.controller('TaskDefinitionStateCtrl', ($scope, newTaskService) ->

  # Ensure taskData exists (prevents "Cannot set property 'source' of undefined")
  $scope.taskData ?= {}

  # Swap the data source to definition-based query, while reusing inbox UI
  $scope.taskData.source = newTaskService.queryTasksForTaskExplorer.bind(newTaskService)
  $scope.taskData.taskDefMode = true

  # Show inbox search UI options on the Task Explorer view
  $scope.showSearchOptions = true

  # Ensure filters exists (safe when navigating directly before unit loads)
  $scope.filters ?= {}

  setDefaultDefId = (defs) ->
    return if $scope.filters.taskDefinitionIdSelected?
    return unless defs? and defs.length > 0
    $scope.filters.taskDefinitionIdSelected = defs[0].id

  # If already loaded
  setDefaultDefId($scope.unit?.taskDefinitions)

  # If loaded later
  $scope.$watch 'unit.taskDefinitions', (defs) ->
    setDefaultDefId(defs)
)
