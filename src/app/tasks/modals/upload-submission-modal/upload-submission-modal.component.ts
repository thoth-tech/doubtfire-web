import { Component, Input, Inject} from '@angular/core';
import { rootScope, taskService, Task, groupService, projectService, alertService, outcomeService} from 'src/app/ajs-upgraded-providers';

   
@Component({
   selector: 'upload-submission-modal',
   templateUrl: 'tasks/modals/upload-submission-modal/upload-submission-modal.component.html',
   styleUrls: ['upload-submission-modal.component.scss'],
}) 

export class UploadSubmissionModal { 

   UploadSubmissionFactory: any; 
   constructor(@Inject($modal) private $modal: any, @Inject(alertService) private alertService: any) {   
    // Open a grade task modal with the provided task  
    this.UploadSubmissionFactory = {};
    this.UploadSubmissionFactory.show = function(task: any, reuploadEvidence: any, isTestSubmission = false) { 
      // Refuse to open modal if group task and not in a group  
      if (!isTestSubmission && task.isGroupTask() && !task.studentInAGroup()){
      alertService.add('danger', "This is a group assignment. Join a #{task.definition.group_set.name} group set to submit this task.", 8000)
      return null
      }
      if (isTestSubmission) {
          task.canReuploadEvidence = false;
          // task.definition = {id: task.id, abbreviation: task.abbreviation, upload_requirements: task.upload_requirements}
          // task.project = -> project
          task.isTestSubmission = isTestSubmission
      }
      return $modal.open({
        templateUrl: 'tasks/modals/upload-submission-modal.component.html',
        controller: UploadSubmissionModalCtrl,
        size: 'lg',
        keyboard: false,
        backdrop: 'static',
        resolve: {
          task: function() {
            return task;
          },
          reuploadEvidence: function() {
            return reuploadEvidence;
          }
        }
      }); 
    };
    return this.UploadSubmissionFactory; 
};
}
class UploadSubmissionModalCtrl {

  @Input() task: any;  
  @Input() reuploadEvidence: any;  

  submissionType: any;
  initialAlignments: any;
  mapAlignmentDataToPayload: any;
  mapTeamToPayload: any;
  staffAlignments: any;
  states: any;
  submissionTypes: any;

  uploader: any;
  isHidden: any; 
  goToState: { next: any; previous: any; };
  shouldDisableBtn: { next: () => any; back: () => boolean; submit: () => boolean; cancel: () => any; };
  shouldShowBtn: { cancel: () => boolean; next: () => boolean; back: () => boolean; submit: () => boolean; };
  team: { members: any[]; };
  comment: string;
  alignmentsRationale: any;
  ilos: any[];
  alignments: any[];

    //$scope, $rootScope, $timeout,   

  constructor(@Inject(alertService) private alertService: any, 
  @Inject(Task) private taskFactory: any, 
  @Inject(taskService) private taskService: any, 
  @Inject(groupService) private groupService: any,
  @Inject(projectService) private projectService: any,
  @Inject(alertService) private alertService: any,
  @Inject(outcomeService) private outcomeService: any,
  @Inject($modalInstance) private $modalInstance: any,
  @Inject(rootScope) private rootScope: any,) { 
 
// Set up submission types
  this.submissionTypes = _.chain(taskService.submittableStatuses).map(function(status) {
    return [status, taskService.statusLabels[status]];
  }).fromPairs().value(); 

  // [[0,"hey"], [1, "he1"]] -> {0: "hey", 1: "he1"} -> ["hey", "he1"]

  if (this.task.canReuploadEvidence())
      this.submissionTypes['reupload_evidence'] = 'New Evidence'

  // Load in submission type
  if (this.task.isTestSubmission){
      this.submissionType = 'test_submission'
      this.submissionTypes = {'test_submission': 'Test Submission'}
      // submissionTypes['test_submission'] = 'Test Submission'
  }
  else {
    if (this.reuploadEvidence)
       this.submissionType = 'reupload_evidence';
    else 
       this.submissionType = this.task.status
  } 

  //Upload files
  this.uploader = {
    url: this.task.isTestSubmission ? taskFactory.generateTestSubmissionUrl(this.task.unit_id, this.task) : taskFactory.generateSubmissionUrl(this.task.project(), this.task),
    files: _.chain(this.task.definition.upload_requirements).map(function(file) {
      return [
        file.key, {
          name: file.name,
          type: file.type
        }
      ];
    }).fromPairs().value(),
    payload: {},
    isUploading: null,
    isReady: null,
    start: null,
    onBeforeUpload: function() {
      if (_.includes(this.states.shown, 'group')) {
        this.uploader.payload.contributions = mapTeamToPayload();
      }
      if (_.includes(this.states.shown, 'alignment')) {
        this.uploader.payload.alignment_data = mapAlignmentDataToPayload();
      }
      if (this.submissionType === 'need_help') {
        return this.uploader.payload.trigger = 'need_help';
      }
    },
    onSuccess: function(response) {
      this.uploader.response = response;
      if (this.task.isTestSubmission) {
        return this.task.project_id = response.project_id;
      }
    },
    onFailureCancel: $modalInstance.dismiss,
    onComplete: function() {
      $modalInstance.close(this.task);
      if (!this.task.isTestSubmission) {
        if (this.comment.trim().length > 0) {
          this.task.addComment(this.comment);
        }
      }
      rootScope.$broadcast('TaskSubmissionUploadComplete', this.task); 
      
     setTimeout(() => {                           
        var response: { status: any; };
        if (!this.task.isTestSubmission) {
          response = this.uploader.response;
          return taskService.processTaskStatusChange(this.task.unit(), this.task.project(), this.task, response.status, response);
        }
      }, 1500);
    }
  };

  //States functionality
  this.states = {
    //All possible states
    all: ['group', 'files', 'alignment', 'comments', 'uploading'],
    //Only states which are shown (populated in initialise)
    shown: [],
    //The currently active state (set in initialise)
    active: null,
    //Current index of the active state
    activeIdx: function() {this.states.shown.indexOf(this.states.active)},
    //Sets the active state
    setActive: function(state: any) {this.states.active = state},
    //Sets the active state to the next state that should be shown
    next: function() {this.states.setActive(this.states.shown[this.states.activeIdx() + 1])},
    //Sets the active state to the previous state that should be shown
    previous: function() {this.states.setActive(this.states.shown[this.states.activeIdx() - 1])},
    //Decides whether this state is hidden to the left or right of the active state
    isHidden: function(state: any) {
      return {
      left: this.states.shown.indexOf(state) < this.states.activeIdx(),
      right: this.states.shown.indexOf(state) > this.states.activeIdx()
      }
    },
    //Conditions on which to remove specific states
    removed: function(){
      var isRFF: boolean, isTestSubmission: boolean, removed: string[];
      isRFF = this.submissionType === 'ready_for_feedback';
      isTestSubmission = this.submissionType === 'test_submission';
      removed = [];
      if (!isRFF || !this.task.isGroupTask()) {
        removed.push('group');
      }
      if (!isRFF || !(this.task.unit().ilos.length > 0)) {
        removed.push('alignment');
      }
      if (isTestSubmission) {
        removed.push('comments');
      }
      return removed;
    },
    //Initialises the states
    initialise: function() {
      this.states.shown = _.difference(this.states.all, this.states.removed());
      return this.states.setActive(_.first(this.states.shown));
    }
  };
  this.states.initialise()

  //If the submission type changes, then modify status (if applicable) and
  //reinitialise states
  function onSelectNewSubmissionType (newType: string) {
    if (newType !== 'reupload_evidence') {
      this.task.status = newType;
    }
    this.submissionType = newType;
    return this.states.initialise();
  }

  //Whether to apply ng-hide to state
  this.isHidden = this.states.isHidden

  //Go to next or previous state
  this.goToState = {
    next: this.states.next,
    previous: this.states.previous
  }

  //Whether or not we should disable this button
  this.shouldDisableBtn = {
    next: function() {
      var name: string | number, shouldDisableByState: any;
      shouldDisableByState = {
        group: function() {
          return _.chain(this.team.members).map('confRating').compact().value().length === 0;
        },
        alignment: function() {
          return _.chain(this.alignments).map('rating').compact().value().length === 0 || this.alignmentsRationale.trim().length === 0;
        },
        files: function() {
          return !this.uploader.isReady;
        }
      };
      return (typeof shouldDisableByState[name = this.states.active] === "function" ? shouldDisableByState[name]() : void 0) || false;
    },
    back: function() {
      return false;
    },
    submit: function() {
      return !this.uploader.isReady || (this.comment.trim().length === 0 && this.submissionType === 'need_help');
    },
    cancel: function() {
      return this.uploader.isUploading;
    }
  };

  //Whether or not we should show this button
  this.shouldShowBtn = {
    cancel: function() {
      return !this.uploader.isUploading;
    },
    next: function() {
      var nextState: string;
      nextState = this.states.shown[this.states.activeIdx() + 1];
      return (nextState != null) && nextState !== 'uploading';
    },
    back: function() {
      var prevState: string;
      prevState = this.states.shown[this.states.activeIdx() - 1];
      return (prevState != null) && prevState !== 'uploading';
    },
    submit: function() {
      return this.states.activeIdx() === this.states.shown.indexOf('uploading') - 1;
    }
  };

  //Click upload on UI
  function uploadButtonClicked (){
    //Move files to the end to simulate as though state move
    this.states.shown = _.without(this.states.shown, 'files');
    this.states.shown.push('files');
    setTimeout(() => {                           
      var response: { status: any; };
      this.states.setActive('files');
      return this.uploader.start(); 
    }, 251);  
  };

  //Team for group state (populated by assignment rater)
  this.team = { members: [] }

  //Maps team data to payload data
  function mapTeamToPayload () {
    var total: number;
    total = groupService.groupContributionSum(this.team.members);
    return _.map(this.team.members, function(member) {
      return {
        project_id: member.project_id,
        pct: (100 * member.rating / total).toFixed(0),
        pts: member.rating
      };
    });
  };

  //Comment on the task
  this.comment = ""

  //Maps the alignment data to payload data
  function mapAlignmentDataToPayload(){
    return _.chain(this.alignments).map(function(alignment, key) {
      alignment.rationale = this.alignmentsRationale;
      alignment.ilo_id = +key;
      return alignment;
    }).filter(function(alignment) {
      return alignment.rating > 0;
    }).value();
  };

  if (!this.task.isTestSubmission) {
    this.initialAlignments = this.task.project().task_outcome_alignments.filter(function(a: { task_definition_id: any; }) {
      return a.task_definition_id === this.task.definition.id;
    });

    this.alignmentsRationale = this.initialAlignments.length > 0 ? this.initialAlignments[0].description : "";
    this.staffAlignments = this.task.staffAlignments();
    this.ilos = _.map(this.task.unit().ilos, function(ilo) {
      var staffAlignment: { rating?: any; label?: any; };
      staffAlignment = _.find(this.staffAlignments, {
        learning_outcome_id: ilo.id
      });
      if (staffAlignment == null) {
        staffAlignment = {};
      }
      if (staffAlignment.rating == null) {
        staffAlignment.rating = 0;
      }
      staffAlignment.label = outcomeService.alignmentLabels[staffAlignment.rating];
      ilo.staffAlignment = staffAlignment;
      return ilo;
    });

    // $scope.alignments = _.chain(task.unit().ilos)
    // .map((ilo) ->
    //   value = initialAlignments.filter((a) -> a.learning_outcome_id == ilo.id)?[0]?.rating
    //   value ?= 0
    //   [ilo.id, {rating: value }]
    // )
    // .fromPairs()
    // .value()
    
  } else {
    this.ilos = [];
    this.alignments = [];
    this.alignmentsRationale = "";
  }
}}



