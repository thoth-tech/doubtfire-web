angular.module('doubtfire.groups.group-member-list', [])
.directive('groupMemberList', function() {
  return {
    restrict: 'E',
    templateUrl: 'groups/group-member-list/group-member-list.tpl.html',
    scope: {
      unit: '=',
      project: '=',
      unitRole: '=',
      selectedGroup: '=',
      onMembersLoaded: '=?'
    },
    controller: ['$scope', '$timeout', 'gradeService', 'alertService', 'listenerService',
      function($scope, $timeout, gradeService, alertService, listenerService) {
        // Cleanup
        var listeners = listenerService.listenTo($scope);

        // Initial sort orders
        $scope.tableSort = {
          order: 'student_name',
          reverse: false
        };

        // Table sorting
        $scope.sortTableBy = function(column) {
          $scope.tableSort.order = column;
          $scope.tableSort.reverse = !$scope.tableSort.reverse;
        };

        // Loading
        var startLoading  = function() { $scope.loaded = false; };
        var finishLoading = function() {
          $timeout(function() {
            $scope.loaded = true;
            if (typeof $scope.onMembersLoaded === 'function') {
              $scope.onMembersLoaded();
            }
          }, 500);
        };

        // Initially not loaded
        $scope.loaded = false;

        // Remove group members
        $scope.removeMember = function(member) {
          $scope.selectedGroup.removeMember(member);
        };

        // Listen for changes to group
        listeners.push($scope.$watch("selectedGroup.id", function(newGroupId) {
          if (!newGroupId) { return; }
          startLoading();
          $scope.canRemoveMembers = $scope.unitRole || ($scope.selectedGroup.groupSet.allowStudentsToManageGroups && !$scope.selectedGroup.locked);

          $scope.selectedGroup.getMembers().subscribe({
            next: function(members) {
              finishLoading();
            },
            error: function(failure) {
              $timeout(function() {
                alertService.add("danger", "Unauthorised to view members in this group", 3000);
                $scope.selectedGroup = null;
              }, 1000);
            }
          });
        }));
      }
    ]
  };
});

