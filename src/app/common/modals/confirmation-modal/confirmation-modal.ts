import angular from 'angular';

interface IConfirmationModalService {
  show: (title: string, message: string, action: () => void) => void;
}

const ConfirmationModalModule = angular
  .module('doubtfire.common.modals.confirmation-modal', [])
  .factory('ConfirmationModal', ($modal: any) => {
    const ConfirmationModal: IConfirmationModalService = {
      show: (title: string, message: string, action: () => void) => {
        const modalInstance = $modal.open({
          templateUrl: 'common/modals/confirmation-modal/confirmation-modal.tpl.html',
          controller: 'ConfirmationModalCtrl',
          resolve: {
            title: () => title,
            message: () => message,
            action: () => action,
          },
        });
      },
    };
    return ConfirmationModal;
  });

/*
Controller for confirmation modal
*/

ConfirmationModalModule.controller(
  'ConfirmationModalCtrl',
  ($scope: any, $modalInstance: any, title: string, message: string, action: () => void, alertService: any) => {
    $scope.title = title;
    $scope.message = message;

    $scope.confirmAction = () => {
      action();
      $modalInstance.dismiss();
    };

    $scope.cancelAction = () => {
      alertService.add('info', `${title} action cancelled`, 3000);
      $modalInstance.dismiss();
    };
  },
);
