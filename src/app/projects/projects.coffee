# Parent projects module.
# Current dependencies are still active.
# Note: outcomes-related logic is currently split between the outcomes state
# and project-outcome-alignment and should be consolidated in a future refactor.

angular.module('doubtfire.projects', [
  'doubtfire.projects.states'
  'doubtfire.projects.project-outcome-alignment'
  'doubtfire.projects.project-progress-dashboard'
])