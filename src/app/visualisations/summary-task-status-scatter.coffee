angular.module('doubtfire.visualisations.summary-task-status-scatter', [])

.directive('summaryTaskStatusScatter', function() {
  return {
    replace: true,
    restrict: 'E',
    templateUrl: 'visualisations/visualisation.tpl.html',
    scope: {
      data: '=',
      unit: '='
    },
    controller: function($scope, newTaskService, Visualisation) {
      ## Function to format y-axis tick labels
      var yAxisTickFormatFunction = function(value) {
        if ($scope.unit.taskDefinitions[value]) {
          return $scope.unit.taskDefinitions[value].abbreviation;
        } else {
          return '';
        }
      };

      ## Function to format x-axis tick labels
      var xAxisTickFormatFunction = function(value) {
        var idx = Math.floor(value);
        return newTaskService.statusAcronym.get(newTaskService.statusKeys[idx]);
      };

      ## Set options and config for scatter chart
      var [options, config] = Visualisation('scatterChart', 'Task Status Summary Scatter Chart', {
        xAxis: {
          axisLabel: 'Statuses',
          tickFormat: xAxisTickFormatFunction
        },
        yAxis: {
          axisLabel: 'Task',
          tickFormat: yAxisTickFormatFunction
        },
        showDistX: true,
        showDistY: true
      }, {});

      ##Assign options and config to scope
      $scope.options = options;
      $scope.config = config;
    }
  };
});
