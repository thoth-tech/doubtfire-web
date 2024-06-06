angular.module('doubtfire.visualisations.summary-task-status-scatter', [])

.directive 'summaryTaskStatusScatter', ->
  replace: true
  restrict: 'E'
  templateUrl: 'visualisations/visualisation.tpl.html'
  scope:
    data: '='
    unit: '='
  controller: ($scope, newTaskService, Visualisation) ->
    # Function to format y-axis tick labels
    yAxisTickFormatFunction = (value) ->
      if $scope.unit.taskDefinitions[value]
        $scope.unit.taskDefinitions[value].abbreviation
      else
        ''

    # Function to format x-axis tick labels
    xAxisTickFormatFunction = (value) ->
      idx = Math.floor(value)
      newTaskService.statusAcronym.get(newTaskService.statusKeys[idx])

    # Set options and config for scatter chart
    [$scope.options, $scope.config] = Visualisation 'scatterChart', 'Task Status Summary Scatter Chart', {
      xAxis:
        axisLabel: 'Statuses'
        tickFormat: xAxisTickFormatFunction
      yAxis:
        axisLabel: 'Task'
        tickFormat: yAxisTickFormatFunction
      showDistX: yes
      showDistY: yes
    }, {}
