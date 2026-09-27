import {ChangeDetectionStrategy, Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {FeedbackModerationActionType} from 'src/app/api/models/task';
import {Task} from 'src/app/api/models/task';
import {TaskService} from 'src/app/api/services/task.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {ConfirmModerationModalData} from './confirm-moderation-modal.service';

@Component({
  selector: 'f-confirm-moderation-modal',
  templateUrl: './confirm-moderation-modal.component.html',
  styleUrl: './confirm-moderation-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ConfirmModerationModalComponent implements OnInit {
  task: Task;
  title: string;
  description: string;
  action: FeedbackModerationActionType;
  showDismissAll: boolean;
  callback: (applyToAll: boolean) => void;

  dismissAllTasks: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<ConfirmModerationModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmModerationModalData,
    private alerts: AlertService,
    private taskService: TaskService,
  ) {}

  ngOnInit() {
    this.task = this.data.task;
    this.title = this.data.title;
    this.description = this.data.description;
    this.action = this.data.action;
    this.showDismissAll = this.data.showDismissAll;
    this.callback = this.data.callback;
  }

  private static readonly ACTION_ICONS: Record<FeedbackModerationActionType, string> = {
    show_less: 'thumb_up',
    show_more: 'flag',
    dismiss_ok: 'archive',
    dismiss_good: 'task_alt',
    overturn: 'gavel',
    upheld: 'verified',
    snooze: 'snooze',
  };

  public get actionIcon(): string {
    return ConfirmModerationModalComponent.ACTION_ICONS[this.action] ?? 'rate_review';
  }

  // The task may belong to a tutorial with no tutor, or to a student in no tutorial,
  // and the dialog must still open so the task can be moderated.
  public get tutorName(): string {
    return this.task?.tutor?.user?.displayName ?? this.task?.tutor?.user?.name ?? 'not assigned';
  }

  public runCallback() {
    this.callback(this.dismissAllTasks);
    this.dismiss();
  }

  public dismiss() {
    this.dialogRef.close();
  }
}
