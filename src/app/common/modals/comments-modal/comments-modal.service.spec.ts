import {describe, expect, it, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {TaskComment} from 'src/app/api/models/doubtfire-model';
import {CommentsModalComponent} from './comments-modal.component';
import {CommentsModalService} from './comments-modal.service';

describe('CommentsModalService', () => {
  it('opens a bounded dialog with focus restoration, close control focus and Escape enabled', () => {
    const open = vi.fn();
    TestBed.configureTestingModule({
      providers: [CommentsModalService, {provide: MatDialog, useValue: {open}}],
    });
    const service = TestBed.inject(CommentsModalService);
    const comment = {
      commentType: 'pdf',
      attachmentFileName: 'feedback.pdf',
    } as TaskComment;

    service.show('/comments/3', comment);

    expect(open).toHaveBeenCalledWith(
      CommentsModalComponent,
      expect.objectContaining({
        data: {commentResourceUrl: '/comments/3', comment},
        maxWidth: '960px',
        maxHeight: '100dvh',
        autoFocus: '.comments-modal__close',
        restoreFocus: true,
        disableClose: false,
        ariaLabelledBy: 'comments-modal-title',
      }),
    );
  });
});
