angular.module('doubtfire.units.states.tasks', [
  'doubtfire.units.states.tasks.inbox'
  'doubtfire.units.states.tasks.definition'
])

#
# Teacher child state for units for task-related activites
#
.config(($stateProvider) ->
  $stateProvider.state 'units/tasks', {
    abstract: true
    parent: 'units/index'
    url: '/tasks'
    controller: 'UnitsTasksStateCtrl'
    template: '<ui-view/>'
    data:
      pageTitle: "_Home_"
      roleWhitelist: ['Tutor', 'Convenor', 'Admin', 'Auditor']
   }
)

.controller('UnitsTasksStateCtrl', ($scope, $state, newTaskService, listenerService, $transition$) ->
  # Cleanup
  listeners = listenerService.listenTo($scope)

  # Sets task key from URL parameters (safe for missing/empty values)
  setTaskKeyFromUrlParams = (taskKeyString) ->
    if taskKeyString?
      # Ensure string format for safety
      $scope.taskData.taskKey = newTaskService.taskKeyFromString("#{taskKeyString}")
    else
      $scope.taskData.taskKey = null

  # Sets URL parameters for the task key (avoid redundant state.go)
  setTaskKeyAsUrlParams = (task) ->
    newKey = task?.taskKeyToUrlString()
    # If key hasn't changed, do nothing
    return if $state.params.taskKey == newKey
    # Change URL of new task without notify
    $state.go($state.$current, {taskKey: newKey}, {notify: false})

  # Task data wraps:
  #  * the URL task composite key (project username + task def abbreviation) sourced from the URL,
  #  * the task source used for the task inbox list,
  #  * the actual selectedTask reference
  #  * the callback for when a task is updated (accepts the new task)
  $scope.taskData = {
    taskKey: null
    source: null
    selectedTask: null
    onSelectedTaskChange: (task) ->
      $scope.taskData.taskKey = task?.taskKey() ? null
      setTaskKeyAsUrlParams(task)
  }

  # Child states will use taskKey to notify what task has been selected on first load.
  taskKey = $transition$.params().taskKey
  setTaskKeyFromUrlParams(taskKey)

  # Whenever the state is changed, update taskKey from URL params.
  listeners.push $scope.$on '$stateChangeStart', ($event, toState, toParams, fromState, fromParams) ->
    setTaskKeyFromUrlParams(toParams.taskKey)

    # Prevent unnecessary scope teardown/rebuild only when nothing actually changes.
    sameState = fromState == toState
    sameUnit  = fromParams.unitId == toParams.unitId
    sameTask  = fromParams.taskKey == toParams.taskKey
    $event.preventDefault() if sameState && sameUnit && sameTask
)
