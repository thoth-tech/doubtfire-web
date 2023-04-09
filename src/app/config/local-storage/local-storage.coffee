angular.module('', [])
#
# Local Storage Configuration
#
.config((localStorageServiceProvider) ->
  localStorageServiceProvider.setPrefix('doubtfire')
)
