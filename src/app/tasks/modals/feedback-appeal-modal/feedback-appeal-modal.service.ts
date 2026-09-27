import {Injectable} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {Task} from 'src/app/api/models/task';
import {FeedbackAppealModalComponent} from './feedback-appeal-modal.component';

export interface FeedbackAppealModalData {
  task: Task;
}

@Injectable({
  providedIn: 'root',
})
export class FeedbackAppealModalService {
  constructor(public dialog: MatDialog) {}

  public show(task: Task) {
    return this.dialog.open<FeedbackAppealModalComponent, FeedbackAppealModalData>(
      FeedbackAppealModalComponent,
      {
        autoFocus: 'dialog',
        closeOnNavigation: true,
        data: {
          task: task,
        },
        maxHeight: 'calc(100dvh - 2rem)',
        maxWidth: '560px',
        panelClass: 'responsive-task-dialog',
        restoreFocus: true,
        width: 'calc(100vw - 2rem)',
        closePredicate: (_result, _config, component) =>
          (component as FeedbackAppealModalComponent | null)?.canClose() ?? true,
      },
    );
  }
}
