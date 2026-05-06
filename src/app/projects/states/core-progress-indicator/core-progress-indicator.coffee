angular.module('doubtfire.projects.states.core-progress-indicator', [])

.config ($stateProvider) ->
  $stateProvider.state 'projects/core-progress-indicator',
    parent: 'projects/index'
    url: '/peer-progress'
    controller: 'CoreProgressIndicatorStateCtrl'
    templateUrl: 'projects/states/core-progress-indicator/core-progress-indicator.tpl.html'
    data:
      task: "Peer Progress"
      pageTitle: "_Home_"
      roleWhitelist: ['Student']

.controller 'CoreProgressIndicatorStateCtrl', ($scope) ->
