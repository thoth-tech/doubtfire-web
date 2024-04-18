angular.module('doubtfire.groups.group-member-contribution-assigner', [])

#
# Directive to rate each student's contributions
# in a group task assessment
#
.directive 'groupMemberContributionAssigner', ->
  restrict: 'E'
  templateUrl: 'groups/group-member-contribution-assigner/group-member-contribution-assigner.tpl.html'
  replace: true
  scope:
    task: '='
    project: '='
    team: '=' #out parameter
  controller: ($scope, gradeService) ->
    # Initialize scope variables
    $scope.selectedGroupSet = $scope.task.definition.groupSet
    unless $scope.task.isTestSubmission
      $scope.selectedGroup = $scope.project.getGroupForTask($scope.task)
    $scope.memberSortOrder = 'project.student.name'
    $scope.numStars = 5
    $scope.initialStars = 3
    $scope.percentages =
      danger: 0
      warning: 25
      info: 50
      success: 100

    # Function to check and clear rating
    $scope.checkClearRating = (contrib) ->
      if contrib.confRating == 1 && contrib.overStar == 1 && contrib.rating == 0
        contrib.rating = contrib.percent = 0
      else if contrib.confRating == 1 && contrib.overStar == 1 && contrib.rating == 0
        contrib.rating = 1
      contrib.confRating = contrib.rating

    # Function to calculate member percentage
    memberPercentage = (contrib, rating) ->
      (100 * (rating / $scope.selectedGroup.contributionSum($scope.team.memberContributions, contrib, rating))).toFixed()

    # Function to handle hovering over stars
    $scope.hoveringOver = (contrib, value) ->
      contrib.overStar = value
      contrib.percent = memberPercentage(contrib, value)

    # Function to get grade for a student
    $scope.gradeFor = gradeService.gradeFor

    # Adding group contributions to task uploads
    if $scope.selectedGroup and $scope.selectedGroupSet
      $scope.selectedGroup.getMembers().subscribe
        next: (members) ->
          $scope.team.memberContributions = (member) ->
            result =
              project: member
              rating: $scope.initialStars
              confRating: $scope.initialStars
              percent: 0
            result.percent = memberPercentage(result, $scope.initialStars)
            result
          # Calculate percentage thresholds
          $scope.percentages.warning = +(25 / members.length).toFixed()
          $scope.percentages.info = +(50 / members.length).toFixed()
          $scope.percentages.success = +(95 / members.length).toFixed()
    else
      $scope.team.memberContributions = []

    # Function to determine the percentage class
    $scope.percentClass = (pct) ->
      return 'label-success'  if pct >= $scope.percentages.success
      return 'label-info'     if $scope.percentages.info    <= pct < $scope.percentages.success
      return 'label-warning'  if $scope.percentages.warning <= pct < $scope.percentages.info
      return 'label-danger'   if $scope.percentages.danger  <= pct < $scope.percentages.warning
