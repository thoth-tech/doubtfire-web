#
# Runtime settings executed during AngularJS app startup.
# This module remains an active migration dependency because it handles:
# - unauthorised redirects
# - token timeout redirects
# - state transition role checks
#

angular.module('doubtfire.config.runtime', [])

.run(($rootScope, $state, authenticationService, editableOptions, editableThemes, $transitions) ->
  # Angular xeditable
  editableOptions.theme = 'bs3'
  editableThemes.bs3.inputClass = 'input-sm'
  editableThemes.bs3.buttonsClass = 'btn-sm'

  serialize = (obj, prefix) ->
    str = []
    for p, v of obj
      k = if prefix then prefix + "[" + p + "]" else p
      if typeof v == "object"
        str.push(serialize(v, k))
      else
        str.push(encodeURIComponent(k) + "=" + encodeURIComponent(v))

    str.join("&")

  handleUnauthorisedDest = (toState) ->
    if authenticationService.isAuthenticated()
      $state.go "unauthorised"
    else if $state.current.name isnt "sign_in"
      $state.go "sign_in", { dest: toState.name }

  handleTokenTimeout = ->
    if $state.current.name isnt "timeout"
      $state.go "timeout", { dest: $state.current.name, params: serialize($state.params) }

  handleUnauthorised = ->
    handleUnauthorisedDest($state.current)

  # Redirect the user if they make an unauthorised API request
  $rootScope.$on "unauthorisedRequestIntercepted", handleUnauthorised

  # Redirect the user if their token expires
  $rootScope.$on("tokenTimeout", handleTokenTimeout)

  # Watch for state transition and check role whitelist
  $transitions.onStart {}, (trans) ->
    toState = trans.to()

    return true unless toState.data?.roleWhitelist

    unless authenticationService.isAuthorised toState.data.roleWhitelist
      handleUnauthorisedDest(toState)
      return false
)