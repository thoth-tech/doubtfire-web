import { Injectable , Inject} from '@angular/core';
import {UploadSubmissionModalComponent} from './upload-submission-modal.component'
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import {alertService} from 'src/app/ajs-upgraded-providers';

@Injectable({
  providedIn: 'root',
})

export class UploadSubmissionModalService { 

  constructor(public dialog: MatDialog, @Inject(alertService) private alertService: any) {}

    // Open a grade task modal with the provided task   
  public show(task: any, reuploadEvidence: any, isTestSubmission = false) { 
    let dialogRef: MatDialogRef<UploadSubmissionModalComponent, any>;
     
      // Refuse to open modal if group task and not in a group  
      if (!isTestSubmission && task.isGroupTask() && !task.studentInAGroup()){
      this.alertService.add('danger', "This is a group assignment. Join a #{task.definition.group_set.name} group set to submit this task.", 8000)
      return null
      }
      if (isTestSubmission) {
          task.canReuploadEvidence = false;
          // task.definition = {id: task.id, abbreviation: task.abbreviation, upload_requirements: task.upload_requirements}
          // task.project = -> project
          task.isTestSubmission = isTestSubmission
      }
      dialogRef = this.dialog.open(UploadSubmissionModalComponent, { 
        data : {
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
        }  
      }); 
    } 
  }    