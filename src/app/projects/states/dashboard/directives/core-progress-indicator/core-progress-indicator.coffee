angular.module('doubtfire.projects.states.dashboard.directives.core-progress-indicator', [])

.directive 'coreProgressIndicator', ['$http', 'DoubtfireConstants', ($http, DoubtfireConstants) ->
  restrict: 'E'
  scope:
    project: '='
  templateUrl: 'projects/states/dashboard/directives/core-progress-indicator/core-progress-indicator.tpl.html'

  link: (scope) ->
    scope.progress = null
    scope.error = null

    scope.$watch 'project', (project) ->
      return unless project?

      unitId = project.unit_id || project.unit?.id
      studentId = project.user_id || project.user?.id || project.student?.id


      return unless unitId? && studentId?

      $http.get("#{DoubtfireConstants.API_URL}/peer_progress/#{unitId}/#{studentId}")
        .then (res) ->
          scope.progress = res.data
          scope.error = null
        .catch ->
          scope.error = 'Unable to load progress data.'
]
