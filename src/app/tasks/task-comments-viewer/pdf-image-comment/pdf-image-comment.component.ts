import { Component, OnInit, Input, Inject, OnDestroy } from '@angular/core';
import { alertService, commentsModal } from 'src/app/ajs-upgraded-providers';
import { Project, TaskComment, Task } from 'src/app/api/models/doubtfire-model';
import { FileDownloaderService } from 'src/app/common/file-downloader/file-downloader.service';

@Component({
  selector: 'pdf-image-comment',
  templateUrl: './pdf-image-comment.component.html',
  styleUrls: [],
})
export class PdfImageCommentComponent implements OnInit, OnDestroy {
  @Input() comment: TaskComment;
  @Input() project: Project;
  @Input() task: Task;

  public resourceUrl: string = undefined;

  constructor(
    @Inject(alertService) private alerts: any,
    @Inject(commentsModal) private commentsModalRef: any,
    private fileDownloaderService: FileDownloaderService,
  ) {}

  ngOnInit() {
    if (this.comment.commentType === 'image') this.downloadCommentResource();
  }

  ngOnDestroy(): void {
    if (this.resourceUrl) {
      this.fileDownloaderService.releaseBlob(this.resourceUrl);
      this.resourceUrl = null;
    }
  }

  private downloadCommentResource(fn?: (url: string) => void) {
    const url = this.comment.attachmentUrl;

    this.fileDownloaderService.downloadBlob(
      url,
      ((blobUrl, response) => {
        this.resourceUrl = blobUrl;
        if (fn) fn(blobUrl);
      }).bind(this),
      ((error) => this.alerts.add('danger', `Unable to download image comment. ${error}`, 6000)).bind(this)
    );
  }

  public openCommentsModal() {
    if (this.comment.commentType == 'image') {
      this.commentsModalRef.show(this.resourceUrl, this.comment.commentType);
    } else {
      if (this.comment.commentType === 'pdf') {
        this.fileDownloaderService.downloadFile(this.comment.attachmentUrl, "view.pdf");
      }
    }
  }
}
