import {ChangeDetectionStrategy, Component, Inject, Input, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {TaskComment} from 'src/app/api/models/doubtfire-model';

export interface CommentsModalData {
  comment: TaskComment;
  commentResourceUrl: string;
}

@Component({
  selector: 'comments-modal',
  templateUrl: './comments-modal.component.html',
  styleUrls: ['./comments-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CommentsModalComponent implements OnInit {
  @Input() taskComment: TaskComment;
  @Input() commentResourceUrl: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CommentsModalData,
    private dialogRef: MatDialogRef<CommentsModalComponent>,
  ) {}

  ngOnInit(): void {
    this.taskComment = this.data.comment;
    this.commentResourceUrl = this.data.commentResourceUrl;
  }

  get fileName(): string {
    if (this.taskComment?.attachmentFileName) {
      return this.taskComment.attachmentFileName;
    }
    return this.taskComment?.commentType === 'pdf' ? 'PDF attachment' : 'Image attachment';
  }

  close(): void {
    this.dialogRef.close();
  }
}
