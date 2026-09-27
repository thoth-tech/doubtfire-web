import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatIconModule} from '@angular/material/icon';
import {TaskComment} from 'src/app/api/models/doubtfire-model';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {CommentsModalService} from 'src/app/common/modals/comments-modal/comments-modal.service';
import {SafePipe} from 'src/app/common/pipes/safe.pipe';
import {AlertService} from 'src/app/common/services/alert.service';
import {SentAttachmentCardComponent} from '../sent-attachment-card/sent-attachment-card.component';
import {PdfImageCommentComponent} from './pdf-image-comment.component';

describe('PDF and image attachment keyboard controls', () => {
  let fixture: ComponentFixture<PdfImageCommentComponent>;
  let downloader: {downloadBlob: ReturnType<typeof vi.fn>; releaseBlob: ReturnType<typeof vi.fn>};
  let modal: {show: ReturnType<typeof vi.fn>};
  let alerts: {error: ReturnType<typeof vi.fn>};

  beforeEach(async () => {
    downloader = {
      downloadBlob: vi.fn((_url, success) => success('blob:attachment', undefined)),
      releaseBlob: vi.fn(),
    };
    modal = {show: vi.fn()};
    alerts = {error: vi.fn()};
    await TestBed.configureTestingModule({
      declarations: [PdfImageCommentComponent, SafePipe, SentAttachmentCardComponent],
      imports: [MatIconModule],
      providers: [
        {provide: FileDownloaderService, useValue: downloader},
        {provide: CommentsModalService, useValue: modal},
        {provide: AlertService, useValue: alerts},
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PdfImageCommentComponent);
  });

  // A PDF opens its authorised URL straight away and the modal owns the loading state.
  // An image is fetched on load, so the preview button opens the fetched copy.
  it.each(['pdf', 'image'])('opens the %s preview from a named native button', (commentType) => {
    const comment = {commentType, attachmentUrl: '/attachment'} as TaskComment;
    fixture.componentInstance.comment = comment;
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button).not.toBeNull();
    expect(button.type).toBe('button');
    expect(button.tabIndex).toBe(0);
    expect(button.getAttribute('aria-label')).toBe(
      commentType === 'pdf' ? 'Preview PDF attachment: PDF attachment' : 'Preview image attachment',
    );
    button.focus();
    expect(document.activeElement).toBe(button);
    const enter = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true});
    button.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    // jsdom does not synthesize the native button activation from Enter.
    button.click();

    expect(modal.show).toHaveBeenCalledExactlyOnceWith(
      commentType === 'pdf' ? '/attachment' : 'blob:attachment',
      comment,
    );
    expect(downloader.downloadBlob).toHaveBeenCalledTimes(commentType === 'pdf' ? 0 : 1);
    expect(alerts.error).not.toHaveBeenCalled();
    if (commentType === 'image') {
      expect(button.querySelector('img').getAttribute('alt')).toBe('Image attachment preview');
    }
  });

  it('reports a failed attachment download without opening an empty preview', () => {
    downloader.downloadBlob.mockImplementation((_url, _success, failure) => failure('offline'));
    fixture.componentInstance.comment = {
      commentType: 'image',
      attachmentUrl: '/attachment',
    } as TaskComment;
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();

    expect(modal.show).not.toHaveBeenCalled();
    expect(alerts.error).toHaveBeenCalledWith(
      'Unable to load this image attachment. Please try again.',
      6000,
    );
  });
});
