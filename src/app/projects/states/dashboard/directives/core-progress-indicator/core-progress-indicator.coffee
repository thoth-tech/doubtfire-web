
angular.module('doubtfire.projects.states.dashboard.directives.core-progress-indicator', [])
.directive 'coreProgressIndicator', ($http, DoubtfireConstants) ->
  restrict: 'E'
  scope:
    project: '='
  templateUrl: 'projects/states/dashboard/directives/core-progress-indicator/core-progress-indicator.tpl.html'

  link: (scope) ->

    scope.progress = null

    scope.$watch 'project', (project) ->
      return unless project?

      unitId = project.unit.id
      studentId = project.student?.id || project.studentId || project.userId || project.user_id
      $http.get("#{DoubtfireConstants.API_URL}/peer_progress/#{unitId}/#{studentId}")
        .then (res) ->
          scope.progress = res.data
          .catch ->
          scope.error = 'Unable to load progress data.'



