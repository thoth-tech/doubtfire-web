# Rendered by projects/states/outcomes/outcomes.tpl.html.
# Note: outcomes-related logic currently overlaps with
# projects/states/outcomes/outcomes.coffee.
# Keep behaviour aligned until the outcomes implementation is consolidated.

angular.module("doubtfire.projects.project-outcome-alignment", [])

.directive("projectOutcomeAlignment", ->
  restrict: 'E'
  templateUrl: 'projects/project-outcome-alignment/project-outcome-alignment.tpl.html'
  controller: ($scope, $rootScope, $timeout, outcomeService, alertService, Visualisation, newUnitService) ->
    $scope.poaView = {
      activeTab: 'list'
    }
    $scope.targets = outcomeService.calculateTargets($scope.unit, $scope.unit, $scope.unit.taskStatusFactor)
    $scope.currentProgress = outcomeService.calculateProgress($scope.unit, $scope.project)

    $scope.refreshCharts = Visualisation.refreshAll

    refreshAlignmentData = ->
      $scope.currentProgress.length = 0
      $scope.currentProgress = _.extend $scope.currentProgress, outcomeService.calculateProgress($scope.unit, $scope.project)

    # $scope.$watch 'project', ->
    #   refreshAlignmentData()
    #   $rootScope.$broadcast('ProgressUpdated')

    # $scope.$watch 'project.tasks', ->
    #   refreshAlignmentData()
    #   $rootScope.$broadcast('ProgressUpdated')

    $scope.selectTab = (tab) ->
      if tab is 'progress'
        if !$scope.classStats?
          newUnitService.loadLearningProgressClassStats($scope.unit).subscribe({
            next: (response) -> $scope.classStats = response
            error: (response) ->
              alertService.error(response, 6000)
              $scope.classStats = {}
          })
      $scope.poaView.activeTab = tab
      $scope.refreshCharts()

    # Default tab
    $scope.selectTab('progress')

    $scope.$on('UpdateAlignmentChart', ->
      refreshAlignmentData()
      $rootScope.$broadcast('ProgressUpdated')
    )

)