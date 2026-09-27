import {ChangeDetectionStrategy, Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {Task} from 'src/app/api/models/task';
import {TaskService} from 'src/app/api/services/task.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {FeedbackAppealModalData} from './feedback-appeal-modal.service';

@Component({
  selector: 'f-feedback-appeal-modal',
  templateUrl: './feedback-appeal-modal.component.html',
  styleUrl: './feedback-appeal-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class FeedbackAppealModalComponent implements OnInit {
  task: Task;

  reviewComment = '';
  /** Matches the maxlength on the textarea. */
  readonly commentMaxLength = 1000;
  /** The counter turns to the warning colour from this many characters. */
  readonly commentWarnLength = 900;
  submitting = false;
  errorMessage = '';
  private allowClose = false;

  constructor(
    public dialogRef: MatDialogRef<FeedbackAppealModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeedbackAppealModalData,
    private alerts: AlertService,
    private taskService: TaskService,
  ) {}

  ngOnInit() {
    this.task = this.data.task;
  }

  submit(): void {
    const comment = this.reviewComment.trim();
    if (!comment || this.submitting) {
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.task.requestFeedbackReview().subscribe({
      next: (_response) => {
        this.alerts.success(
          `Requested feedback review for ${this.task.definition.abbreviation} ${this.task.definition.name}`,
          3000,
        );
        // Fetch the "Feedback Review Requested" comment, then add only the text
        // the student explicitly submitted.
        this.taskService.notifyStatusChange(this.task);
        this.task.addComment(comment);
        this.allowClose = true;
        this.dialogRef.close();
      },
      error: () => {
        this.errorMessage = 'The feedback review request could not be sent. Please try again.';
        this.alerts.error(this.errorMessage, 4000);
        this.submitting = false;
      },
    });
  }

  public get commentLength(): number {
    return this.reviewComment?.length ?? 0;
  }

  public get commentCounterState(): 'ok' | 'warn' | 'limit' {
    if (this.commentLength >= this.commentMaxLength) {
      return 'limit';
    }
    return this.commentLength >= this.commentWarnLength ? 'warn' : 'ok';
  }

  public get isDirty(): boolean {
    return this.reviewComment.trim().length > 0;
  }

  public canClose(): boolean {
    if (this.allowClose || !this.isDirty) {
      return true;
    }

    return globalThis.confirm(
      'Discard this feedback review request? Your entered reason will be lost.',
    );
  }

  public dismissModal(): void {
    this.dialogRef.close();
  }
}
