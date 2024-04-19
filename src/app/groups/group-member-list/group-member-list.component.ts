angular.module('doubtfire.groups.group-member-list', [])
.directive('groupMemberList', () => {
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
    controller: ['$scope', '$timeout', 'gradeService', 'alertService', 'listenerService', ($scope, $timeout, gradeService, alertService, listenerService) => {
      // Cleanup
      const listeners = listenerService.listenTo($scope);

      // Initial sort orders
      $scope.tableSort = {
        order: 'student_name',
        reverse: false
      };

      // Table sorting
      $scope.sortTableBy = (column: string) => {
        $scope.tableSort.order = column;
        $scope.tableSort.reverse = !$scope.tableSort.reverse;
      };

      // Loading
      const startLoading = () => $scope.loaded = false;
      const finishLoading = () => $timeout(() => {
        $scope.loaded = true;
        if ($scope.onMembersLoaded) {
          $scope.onMembersLoaded();
        }
      }, 500);

      // Initially not loaded
      $scope.loaded = false;

      // Remove group members
      $scope.removeMember = (member) => {
        $scope.selectedGroup.removeMember(member);
      };

      // Listen for changes to group
      listeners.push($scope.$watch("selectedGroup.id", (newGroupId) => {
        if (!newGroupId) {
          return;
        }
        startLoading();
        $scope.canRemoveMembers = $scope.unitRole || ($scope.selectedGroup.groupSet.allowStudentsToManageGroups && !$scope.selectedGroup.locked);

        $scope.selectedGroup.getMembers().subscribe({
          next: (members) => {
            finishLoading();
          },
          error: (failure) => {
            $timeout(() => {
              alertService.add("danger", "Unauthorised to view members in this group", 3000);
              $scope.selectedGroup = null;
            }, 1000);
          }
        });
      }));
    }]
  };
});

