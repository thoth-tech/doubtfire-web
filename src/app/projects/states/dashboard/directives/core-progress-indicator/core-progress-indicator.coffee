
angular.module('doubtfire.projects.states.dashboard.directives.core-progress-indicator', [])
.directive 'coreProgressIndicator', ($http) ->
  restrict: 'E'
  scope:
    project: '='
  templateUrl: 'projects/states/dashboard/directives/core-progress-indicator/core-progress-indicator.tpl.html'

  link: (scope) ->

    scope.progress = null

    scope.$watch 'project', (project) ->
      return unless project?
      console.log "Core progress project:", project

      unitId = project.unit.id
      studentId = project.user_id || project.user?.id || project.student?.id

      $http.get("/api/peer_progress/#{unitId}/#{studentId}")
        .then (res) ->
          scope.progress = res.data
