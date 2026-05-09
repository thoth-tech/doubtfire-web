angular.module('doubtfire.tutor-analytics', [])

.directive 'tutorAnalytics', ->
  restrict: 'E'
  replace: true
  templateUrl: 'tutor-analytics/tutor-analytics.tpl.html'

  controller: ($scope) ->

    # Mock student analytics data
    $scope.students = [
      {
        name: 'John Smith'
        completed: 8
        pending: 2
        engagement: 'High'
        progress: 80
        grade: 'HD'
      }
      {
        name: 'Sarah Lee'
        completed: 5
        pending: 5
        engagement: 'Medium'
        progress: 50
        grade: 'D'
      }
      {
        name: 'Michael Brown'
        completed: 3
        pending: 7
        engagement: 'Low'
        progress: 30
        grade: 'C'
      }
      {
        name: 'Emma Wilson'
        completed: 9
        pending: 1
        engagement: 'High'
        progress: 90
        grade: 'HD'
      }
    ]

    # Search model
    $scope.searchText = ''

    # Count total students
    $scope.totalStudents = $scope.students.length

    # Count at-risk students
    $scope.atRiskCount = 0

    angular.forEach $scope.students, (student) ->
      if student.pending > 5
        $scope.atRiskCount++

    # Determine if student is at risk
    $scope.isAtRisk = (student) ->
      student.pending > 5

    # Calculate average progress
    totalProgress = 0
    $scope.averageProgress = Math.round(totalProgress / $scope.students.length)