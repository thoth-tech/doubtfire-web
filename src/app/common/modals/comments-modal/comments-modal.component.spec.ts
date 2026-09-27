import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {TaskComment} from 'src/app/api/models/doubtfire-model';
import {CommentsModalComponent, CommentsModalData} from './comments-modal.component';

describe('CommentsModalComponent', () => {
  let fixture: ComponentFixture<CommentsModalComponent>;
  const close = vi.fn();
  const data: CommentsModalData = {
    commentResourceUrl: '/comments/22',
    comment: {
      commentType: 'pdf',
      attachmentFileName: 'Long evidence filename.pdf',
    } as TaskComment,
  };

  beforeEach(async () => {
    close.mockReset();
    await TestBed.configureTestingModule({
      declarations: [CommentsModalComponent],
      providers: [
        {provide: MAT_DIALOG_DATA, useValue: data},
        {provide: MatDialogRef, useValue: {close}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentsModalComponent);
    fixture.detectChanges();
  });

  it('passes the real filename and URL into the responsive PDF viewer', () => {
    const heading = fixture.nativeElement.querySelector('h2') as HTMLHeadingElement;
    const viewer = fixture.nativeElement.querySelector('f-pdf-viewer') as HTMLElement;
    expect(heading.textContent).toContain('Long evidence filename.pdf');
    expect(viewer).toBeTruthy();
    expect(fixture.componentInstance.fileName).toBe('Long evidence filename.pdf');
    expect(fixture.componentInstance.commentResourceUrl).toBe('/comments/22');
  });

  it('has an explicit close action', () => {
    const closeButton = fixture.nativeElement.querySelector(
      '.comments-modal__close',
    ) as HTMLButtonElement;
    expect(closeButton.getAttribute('aria-label')).toBe('Close attachment preview');
    closeButton.click();
    expect(close).toHaveBeenCalledOnce();
  });
});
