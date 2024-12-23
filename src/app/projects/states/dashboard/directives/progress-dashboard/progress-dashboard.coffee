angular.module('doubtfire.projects.states.dashboard.directives.progress-dashboard', [])
.directive 'progressDashboard', ->
  restrict: 'E'
  templateUrl: 'projects/states/dashboard/directives/progress-dashboard/progress-dashboard.tpl.html'
  scope:
    project: '='
    onUpdateTargetGrade: '='
  controller: ($scope, $stateParams, newProjectService, gradeService, analyticsService, alertService, $http, DoubtfireConstants) ->

    # Is the current user a tutor?
    $scope.tutor = $stateParams.tutor

    # Number of tasks completed and remaining
    updateTaskCompletionValues = ->
      completedTasks = $scope.project.numberTasks("complete")
      $scope.numberOfTasks =
        completed: completedTasks
        remaining: $scope.project.activeTasks().length - completedTasks
    updateTaskCompletionValues()

    # Expose grade names and values
    $scope.grades =
      names: gradeService.grades
      values: gradeService.gradeValues

    # Fetch Target Grade History
    $scope.targetGradeHistory = []

    $http.get("#{DoubtfireConstants.API_URL}/projects/#{$scope.project.id}")
      .then (response) ->
        $scope.targetGradeHistory = response.data.target_grade_histories
      .catch (error) ->
        alertService.error("Failed to load target grade history", 4000)

    $scope.updateTargetGrade = (newGrade) ->
      $scope.project.targetGrade = newGrade
      newProjectService.update($scope.project).subscribe(
        (project) ->
          project.refreshBurndownChartData()

          # Update task completions and re-render task status graph
          updateTaskCompletionValues()
          $scope.renderTaskStatusPieChart?()
          $scope.onUpdateTargetGrade?()
          analyticsService.event(
            "Student Project View - Progress Dashboard",
            "Grade Changed",
            $scope.grades.names[newGrade]
          )

          # Fetch updated target grade history
          $http.get("#{DoubtfireConstants.API_URL}/projects/#{$scope.project.id}")
            .then (response) ->
              $scope.targetGradeHistory = response.data.target_grade_histories
            .catch (error) ->
              alertService.error("Failed to reload target grade history", 4000)

          alertService.success("Updated target grade successfully", 2000)

        , (failure) ->
          alertService.error("Failed to update target grade", 4000)
      )
