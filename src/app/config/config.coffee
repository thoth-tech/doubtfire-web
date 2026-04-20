#
# Parent AngularJS configuration module.
# This module is still required during migration because runtime and routing
# behaviour remain active in AngularJS bootstrapping.
#
# Keep the dependency order unchanged unless child config modules are fully
# migrated and verified safe to remove.
#

angular.module('doubtfire.config', [
  'doubtfire.config.vendor-dependencies'
  'doubtfire.config.local-storage'
  'doubtfire.config.routing'
  'doubtfire.config.analytics'
  'doubtfire.config.runtime'
  'doubtfire.config.root-controller'
  'doubtfire.config.debug'
  'doubtfire.config.privacy-policy'
])