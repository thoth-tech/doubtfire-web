angular.module('doubtfire.config.routing', [])

#
# AngularJS routing configuration still used during migration.
# This module currently handles root/home URL redirects.
# Unmatched URL fallback is also configured in doubtfire-angularjs.module.ts.
#
.config(($urlRouterProvider) ->
  # Map empty URL to root.
  $urlRouterProvider.when "", "/"

  # Map root URL to home.
  $urlRouterProvider.when "/", "/home"
)