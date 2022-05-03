import { Component, Input, Inject, OnInit} from '@angular/core';
import { rootScope, taskService, Task, groupService, projectService, currentUser, PrivacyPolicy, uploadSubmissionModalService} from 'src/app/ajs-upgraded-providers';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import * as _ from 'lodash';

   
@Component({
 
   selector: 'upload-submission-modal',
   templateUrl: './upload-submission-modal.component.html',
   styleUrls: ['./upload-submission-modal.component.scss'],
}) 

export class UploadSubmissionModalComponent implements OnInit { 


  @Input() task: any;  
  @Input() reuploadEvidence: any;  
  @Input() showPlagiarism: any;  

  submissionType: any;
  initialAlignments: any;
  mapAlignmentDataToPayload: any;
  mapTeamToPayload: any;
  staffAlignments: any;
  states: any;
  submissionTypes: any;
  privacyPolicy

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

  constructor(
      @Inject(MAT_DIALOG_DATA) public data: any,
      public dialogRef: MatDialogRef<UploadSubmissionModalComponent>,
      @Inject(currentUser) public CurrentUser: any,
      @Inject(PrivacyPolicy) private PrivacyPolicy: any, 
      @Inject(Task) private taskFactory: any, 
      @Inject(taskService) private taskService: any, 
      @Inject(groupService) private groupService: any,
      @Inject(projectService) private projectService: any,
      @Inject(rootScope) private rootScope: any,
      @Inject(uploadSubmissionModalService) private uploadSubmissionModalService: any,
      
      ) {}
   
  ngOnInit(): void { 

    this.privacyPolicy = PrivacyPolicy; 
// Set up submission types
  this.submissionTypes = _.chain(this.taskService.submittableStatuses).map(function(status) {
    return [status, this.taskService.statusLabels[status]];
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
    url: this.task.isTestSubmission ? this.taskFactory.generateTestSubmissionUrl(this.task.unit_id, this.task) : this.taskFactory.generateSubmissionUrl(this.task.project(), this.task),
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
    onSuccess: function(response: { project_id: any; }) {
      this.uploader.response = response;
      if (this.task.isTestSubmission) {
        return this.task.project_id = response.project_id;
      }
    },
    onFailureCancel: this.dialogRef.close,
    onComplete: function() {
      this.dialogRef.close(this.task);
      if (!this.task.isTestSubmission) {
        if (this.comment.trim().length > 0) {
          this.task.addComment(this.comment);
        }
      }
      this.rootScope.$broadcast('TaskSubmissionUploadComplete', this.task); 
      
     setTimeout(() => {                           
        var response: { status: any; };
        if (!this.task.isTestSubmission) {
          response = this.uploader.response;
          return this.taskService.processTaskStatusChange(this.task.unit(), this.task.project(), this.task, response.status, response);
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

  //Team for group state (populated by assignment rater)
  this.team = { members: [] }

  //Maps team data to payload data
  function mapTeamToPayload () {
    var total: number;
    total = this.groupService.groupContributionSum(this.team.members);
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
      staffAlignment.label = this.outcomeService.alignmentLabels[staffAlignment.rating];
      ilo.staffAlignment = staffAlignment;
      return ilo;
    });

    // this.alignments = _.chain(this.task.unit().ilos).map((ilo) ->
    //   value = initialAlignments.filter((a) -> a.learning_outcome_id == ilo.id)?[0]?.rating
    //   value ?= 0
    //   [ilo.id, {rating: value }]
    // ).fromPairs().value()
    
  } else {
    this.ilos = [];
    this.alignments = [];
    this.alignmentsRationale = "";
  }
}
//If the submission type changes, then modify status (if applicable) and
  //reinitialise states
  onSelectNewSubmissionType (newType: string) {
    if (newType !== 'reupload_evidence') {
      this.task.status = newType;
    }
    this.submissionType = newType;
    return this.states.initialise();
  }
  
  //Click upload on UI
  uploadButtonClicked (){
    //Move files to the end to simulate as though state move
    this.states.shown = _.without(this.states.shown, 'files');
    this.states.shown.push('files');
    setTimeout(() => {                           
      var response: { status: any; };
      this.states.setActive('files');
      return this.uploader.start(); 
    }, 251);  
  }
  // close dialog 
  dismiss (){
    this.dialogRef.close;
  }
}

