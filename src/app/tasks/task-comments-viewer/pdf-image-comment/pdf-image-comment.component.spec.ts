import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {TaskComment} from 'src/app/api/models/doubtfire-model';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {CommentsModalService} from 'src/app/common/modals/comments-modal/comments-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {PdfImageCommentComponent} from './pdf-image-comment.component';

describe('PdfImageCommentComponent attachment opening', () => {
  let fixture: ComponentFixture<PdfImageCommentComponent>;
  let component: PdfImageCommentComponent;
  let downloader: {
    downloadBlob: ReturnType<typeof vi.fn>;
    releaseBlob: ReturnType<typeof vi.fn>;
  };
  let show: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    downloader = {downloadBlob: vi.fn(), releaseBlob: vi.fn()};
    show = vi.fn();
    await TestBed.configureTestingModule({
      declarations: [PdfImageCommentComponent],
      providers: [
        {provide: FileDownloaderService, useValue: downloader},
        {provide: CommentsModalService, useValue: {show}},
        {provide: AlertService, useValue: {error: vi.fn()}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PdfImageCommentComponent);
    component = fixture.componentInstance;
  });

  it('opens PDF metadata and the authorized URL immediately so the modal owns loading state', () => {
    const comment = {
      commentType: 'pdf',
      attachmentFileName: 'actual-name.pdf',
      attachmentUrl: '/comments/8?as_attachment=false',
    } as TaskComment;
    component.comment = comment;
    fixture.detectChanges();

    expect(downloader.downloadBlob).not.toHaveBeenCalled();
    component.openCommentsModal();
    expect(show).toHaveBeenCalledWith('/comments/8?as_attachment=false', comment);
  });

  it('keeps image preview retrieval silent and releases its object URL', () => {
    component.comment = {
      commentType: 'image',
      attachmentUrl: '/comments/9?as_attachment=false',
    } as TaskComment;
    fixture.detectChanges();
    expect(downloader.downloadBlob).toHaveBeenCalledOnce();

    const success = downloader.downloadBlob.mock.calls[0][1] as (url: string) => void;
    success('blob:image-preview');
    expect(component.resourceUrl).toBe('blob:image-preview');
    component.ngOnDestroy();
    expect(downloader.releaseBlob).toHaveBeenCalledWith('blob:image-preview');
  });
});
