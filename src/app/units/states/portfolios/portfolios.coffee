# angular.module('doubtfire.units.states.portfolios', [])
# #
# # State for staff viewing portfolios
# #
# .config(($stateProvider) ->
#   $stateProvider.state 'units/students/portfolios', {
#     parent: 'units/index'
#     url: '/students/portfolios'
#     templateUrl: "units/states/portfolios/portfolios.tpl.html"
#     controller: "UnitPortfoliosStateCtrl"
#     data:
#       task: "Student Portfolios"
#       pageTitle: "_Home_"
#       roleWhitelist: ['Tutor', 'Convenor', 'Admin', 'Auditor']
#    }
# )
# .controller("UnitPortfoliosStateCtrl", ($scope, alertService, analyticsService, gradeService, newProjectService, Visualisation, newTaskService, fileDownloaderService, newUserService, D2lTransferModal, newUnitService, sidekiqProgressModalService) ->
#   # TODO: (@alexcu) Break this down into smaller directives/substates

#   $scope.unit.loadD2lMapping().subscribe()

#   $scope.downloadGrades = -> fileDownloaderService.downloadFile($scope.unit.gradesUrl, "#{$scope.unit.code}-grades.csv")

#   $scope.downloadPortfolios = ->
#     newUnitService.zipPortfolios($scope.unit).subscribe({
#       next: (newJob) ->
#         sidekiqProgressModalService.show("Downloading Portfolios: " + $scope.unit.code, newJob.id).subscribe({
#           next: (job) ->
#             fileDownloaderService.downloadFile($scope.unit.portfoliosUrl, "#{$scope.unit.code}-portfolios.zip")
#           error: (message) -> alertService.error(message, 6000)
#         })
#       error: (message) -> alertService.error(message, 6000)
#     })


#   $scope.studentFilter = 'allStudents'
#   $scope.portfolioFilter = 'withPortfolio'

#   $scope.statusClass = newTaskService.statusClass
#   $scope.statusText = newTaskService.statusText

#   refreshCharts = Visualisation.refreshAll

#   #
#   # Sets the active tab
#   #
#   $scope.setActiveTab = (tab) ->
#     # Do nothing if we're switching to the same tab
#     return if tab is $scope.activeTab
#     $scope.activeTab?.active = false
#     $scope.activeTab = tab
#     $scope.activeTab.active = true

#     if $scope.activeTab == $scope.tabs.viewProgress
#       refreshCharts()

#   #
#   # Active task tab group
#   #
#   $scope.tabs =
#     selectStudent:
#       title: "Select Student"
#       subtitle: "Select the student to assess"
#       seq: 0
#     viewProgress:
#       title: "View Progress"
#       subtitle: "See the progress of the student"
#       seq: 1
#     viewStaffNotes:
#       title: "View Staff Notes"
#       subtitle: "See notes of the student add by staff"
#       seq: 2
#     viewPortfolio:
#       title: "View Portfolio"
#       subtitle: "See the portfolio of the student"
#       seq: 3
#     assessPortfolio:
#       title: "Assess Portfolio"
#       subtitle: "Enter a grade for the student"
#       seq: 4

#   $scope.setActiveTab($scope.tabs.selectStudent)

#   $scope.tutor = newUserService.currentUser

#   $scope.search = ""

#   # Pagination details
#   $scope.currentPage = 1
#   $scope.maxSize = 5
#   $scope.pageSize = 10

#   $scope.filterOptions = {selectedGrade: -1}
#   $scope.gradeValues = gradeService.gradeValues
#   $scope.grades = gradeService.grades
#   $scope.gradeAcronyms = gradeService.gradeAcronyms

#   $scope.selectedStudent = null

#   $scope.gradeResults = [
#     {
#       name: 'Fail',
#       scores: [ 0, 10, 20, 30, 40, 44 ]
#     }
#     {
#       name: 'Pass',
#       scores: [ 50, 53, 55, 57 ]
#     }
#     {
#       name: 'Credit',
#       scores: [ 60, 63, 65, 67 ]
#     }
#     {
#       name: 'Distinction',
#       scores: [ 70, 73, 75, 77 ]
#     }
#     {
#       name: 'High Distinction',
#       scores: [ 80, 83, 85, 87 ]
#     }
#     {
#       name: 'High Distinction',
#       scores: [ 90, 93, 95, 97, 100 ]
#     }
#   ]

#   $scope.editingRationale = false

#   $scope.toggleEditRationale = ->
#     $scope.editingRationale = !$scope.editingRationale


#   analyticsService.watchEvent $scope, 'studentFilter', 'Teacher View - Grading Tab'
#   analyticsService.watchEvent $scope, 'sortOrder', 'Teacher View - Grading Tab'
#   analyticsService.watchEvent $scope, 'currentPage', 'Teacher View - Grading Tab', 'Selected Page'

#   $scope.selectStudent = (student) ->
#     $scope.selectedStudent = student
#     $scope.project = null
#     newProjectService.loadProject(student, $scope.unit).subscribe({
#       next: (project) ->
#         $scope.project = project
#         $scope.project.preloadedUrl = $scope.project.portfolioUrl()
#       error: (message) -> alertService.error( message, 6000)
#     })

#   $scope.hasD2lMapping = ->
#     $scope.unit.hasD2lMapping()

#   $scope.transferToD2L = ->
#     D2lTransferModal.open($scope.unit)

#   $scope.openProject = ($event, project) ->
#     $event.stopPropagation()
#     # HACK: avoids using window.open() to prevent AngularJS error
#     link = document.createElement('a')
#     link.href = "/projects/#{project.id}/dashboard/?tutor=true"
#     link.target = '_blank'
#     link.click()
# )

angular.module('doubtfire.units.states.portfolios', [])

#
# State for staff viewing portfolios (portfolio grading dashboard)
#
.config(($stateProvider) ->
  $stateProvider.state 'units/students/portfolios',
    parent: 'units/index'
    url: '/students/portfolios'
    templateUrl: 'units/states/portfolios/portfolios.tpl.html'
    controller: 'UnitPortfoliosStateCtrl'
    data:
      task: 'Student Portfolios'
      pageTitle: '_Home_'
      roleWhitelist: ['Tutor', 'Convenor', 'Admin', 'Auditor']
)

.controller 'UnitPortfoliosStateCtrl', (
  $scope,
  alertService,
  analyticsService,
  gradeService,
  newProjectService,
  Visualisation,
  newTaskService,
  fileDownloaderService,
  newUserService,
  D2lTransferModal,
  newUnitService,
  sidekiqProgressModalService
) ->

  # Ensure D2L mapping is available for this unit (used for grade transfer)
  $scope.unit.loadD2lMapping().subscribe()

  #
  # Download CSV of grades for this unit
  #
  $scope.downloadGrades = ->
    fileDownloaderService.downloadFile(
      $scope.unit.gradesUrl,
      "#{$scope.unit.code}-grades.csv"
    )

  #
  # Download a ZIP of all student portfolios for this unit
  #
  $scope.downloadPortfolios = ->
    newUnitService.zipPortfolios($scope.unit).subscribe(
      next: (newJob) ->
        sidekiqProgressModalService
          .show("Downloading Portfolios: " + $scope.unit.code, newJob.id)
          .subscribe(
            next: (job) ->
              fileDownloaderService.downloadFile(
                $scope.unit.portfoliosUrl,
                "#{$scope.unit.code}-portfolios.zip"
              )
            error: (message) ->
              alertService.error(message, 6000)
          )
      error: (message) ->
        alertService.error(message, 6000)
    )

  #
  # Filter + pagination setup
  #
  $scope.studentFilter   = 'allStudents'
  $scope.portfolioFilter = 'withPortfolio'

  $scope.statusClass = newTaskService.statusClass
  $scope.statusText  = newTaskService.statusText

  refreshCharts = Visualisation.refreshAll

  #
  # Tab configuration for the portfolio workflow
  #
  $scope.tabs =
    selectStudent:
      title: 'Select Student'
      subtitle: 'Select the student to assess'
      seq: 0
    viewProgress:
      title: 'View Progress'
      subtitle: 'See the progress of the student'
      seq: 1
    viewStaffNotes:
      title: 'View Staff Notes'
      subtitle: 'See notes of the student added by staff'
      seq: 2
    viewPortfolio:
      title: 'View Portfolio'
      subtitle: 'See the portfolio of the student'
      seq: 3
    assessPortfolio:
      title: 'Assess Portfolio'
      subtitle: 'Enter a grade for the student'
      seq: 4

  #
  # Tab selection logic – refresh charts when switching
  #
  $scope.setActiveTab = (tab) ->
    return if tab is $scope.activeTab   # no-op if same tab
    $scope.activeTab?.active = false
    $scope.activeTab = tab
    $scope.activeTab.active = true

    if $scope.activeTab is $scope.tabs.viewProgress
      refreshCharts()

  # Default tab
  $scope.setActiveTab $scope.tabs.selectStudent

  #
  # Tutor + search + pagination
  #
  $scope.tutor       = newUserService.currentUser
  $scope.search      = ''
  $scope.currentPage = 1
  $scope.maxSize     = 5
  $scope.pageSize    = 10

  #
  # Grade filter + grade metadata
  #
  $scope.filterOptions  = { selectedGrade: -1 }
  $scope.gradeValues    = gradeService.gradeValues
  $scope.grades         = gradeService.grades
  $scope.gradeAcronyms  = gradeService.gradeAcronyms

  $scope.selectedStudent = null

  #
  # Ranges used for quick grade selection in the “Assess Portfolio” tab
  #
  $scope.gradeResults = [
    {
      name: 'Fail'
      scores: [0, 10, 20, 30, 40, 44]
    }
    {
      name: 'Pass'
      scores: [50, 53, 55, 57]
    }
    {
      name: 'Credit'
      scores: [60, 63, 65, 67]
    }
    {
      name: 'Distinction'
      scores: [70, 73, 75, 77]
    }
    {
      name: 'High Distinction (80–87)'
      scores: [80, 83, 85, 87]
    }
    {
      name: 'High Distinction (90–100)'
      scores: [90, 93, 95, 97, 100]
    }
  ]

  $scope.editingRationale = false
  $scope.toggleEditRationale = ->
    $scope.editingRationale = not $scope.editingRationale

  #
  # Analytics: track how teachers interact with the grading view
  #
  analyticsService.watchEvent $scope, 'studentFilter', 'Teacher View - Grading Tab'
  analyticsService.watchEvent $scope, 'sortOrder', 'Teacher View - Grading Tab'
  analyticsService.watchEvent $scope, 'currentPage', 'Teacher View - Grading Tab', 'Selected Page'

  #
  # When a student is selected, load that student's project + portfolio
  #
  $scope.selectStudent = (student) ->
    $scope.selectedStudent = student
    $scope.project = null

    newProjectService.loadProject(student, $scope.unit).subscribe(
      next: (project) ->
        $scope.project = project
        # Preload portfolio URL for the PDF viewer
        $scope.project.preloadedUrl = $scope.project.portfolioUrl()
      error: (message) ->
        alertService.error(message, 6000)
    )

  $scope.hasD2lMapping = ->
    $scope.unit.hasD2lMapping()

  $scope.transferToD2L = ->
    D2lTransferModal.open $scope.unit

  $scope.openProject = ($event, student) ->
    $event.stopPropagation()

    # HACK: avoids using window.open() to prevent AngularJS error
    link = document.createElement('a')
    link.href = "/projects/#{student.projectId}/dashboard/?tutor=true"
    link.target = '_blank'
    link.click()

