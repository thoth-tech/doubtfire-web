import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {Project, Task, TaskComment} from 'src/app/api/models/doubtfire-model';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {CommentsModalService} from 'src/app/common/modals/comments-modal/comments-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';

@Component({
  selector: 'pdf-image-comment',
  templateUrl: './pdf-image-comment.component.html',
  styleUrls: ['./pdf-image-comment.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PdfImageCommentComponent implements OnInit, OnDestroy {
  @Input() comment: TaskComment;
  @Input() project: Project;
  @Input() task: Task;

  public resourceUrl: string = undefined;
  public isLoadingImage = false;

  constructor(
    private alerts: AlertService,
    private commentsModalRef: CommentsModalService,
    private fileDownloaderService: FileDownloaderService,
  ) {}

  ngOnInit() {
    if (this.comment.commentType === 'image') {
      this.downloadCommentResource();
    }
  }

  ngOnDestroy(): void {
    if (this.resourceUrl) {
      this.fileDownloaderService.releaseBlob(this.resourceUrl);
      this.resourceUrl = null;
    }
  }

  private downloadCommentResource(fn?: (url: string) => void) {
    if (this.isLoadingImage) {
      return;
    }

    const url = this.comment.attachmentUrl;
    this.isLoadingImage = true;

    this.fileDownloaderService.downloadBlob(
      url,
      ((blobUrl, _response) => {
        this.isLoadingImage = false;
        this.resourceUrl = blobUrl;
        if (fn) {
          fn(blobUrl);
        }
      }).bind(this),
      ((_error) => {
        this.isLoadingImage = false;
        this.alerts.error('Unable to load this image attachment. Please try again.', 6000);
      }).bind(this),
    );
  }

  public openCommentsModal() {
    if (this.comment.commentType === 'pdf') {
      this.commentsModalRef.show(this.comment.attachmentUrl, this.comment);
      return;
    }

    if (this.resourceUrl) {
      this.commentsModalRef.show(this.resourceUrl, this.comment);
    } else {
      this.downloadCommentResource(this.openCommentsModal.bind(this));
    }
  }
}
