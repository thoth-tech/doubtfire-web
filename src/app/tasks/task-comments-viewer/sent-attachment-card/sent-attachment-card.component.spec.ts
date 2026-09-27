import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {TaskComment} from 'src/app/api/models/doubtfire-model';
import {SentAttachmentCardComponent} from './sent-attachment-card.component';

describe('SentAttachmentCardComponent', () => {
  let fixture: ComponentFixture<SentAttachmentCardComponent>;
  let component: SentAttachmentCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SentAttachmentCardComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SentAttachmentCardComponent);
    component = fixture.componentInstance;
  });

  it('renders a semantic author-aware PDF preview card with filename and size', () => {
    component.comment = {
      authorIsMe: true,
      commentType: 'pdf',
      attachmentFileName: 'A very long supporting statement that must wrap safely.pdf',
      attachmentMimeType: 'application/pdf',
      attachmentByteSize: 1_250_000,
    } as TaskComment;
    component.action = 'preview';
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.type).toBe('button');
    expect(button.classList.contains('sent-attachment-card--own')).toBe(true);
    expect(button.getAttribute('aria-label')).toContain('Preview PDF attachment');
    expect(button.textContent).toContain('A very long supporting statement');
    expect(button.textContent).toContain('1.3 MB');
    expect(button.textContent).toContain('Preview');
  });

  it('identifies DOCX and generic files without relying on colour', () => {
    component.comment = {
      authorIsMe: false,
      commentType: 'document',
      attachmentFileName: 'evidence.DOCX',
      attachmentMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      attachmentByteSize: 890,
    } as TaskComment;
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.classList.contains('sent-attachment-card--other')).toBe(true);
    expect(button.textContent).toContain('DOCX attachment');
    expect(button.textContent).toContain('Download');

    fixture.componentRef.setInput('comment', {
      authorIsMe: false,
      commentType: 'file',
      attachmentFileName: 'results.csv',
      attachmentMimeType: 'text/csv',
    } as TaskComment);
    fixture.detectChanges();
    expect(button.textContent).toContain('CSV attachment');
  });

  it('emits once when available and remains inert while busy', () => {
    component.comment = {
      authorIsMe: true,
      commentType: 'pdf',
      attachmentFileName: 'feedback.pdf',
    } as TaskComment;
    const activate = vi.fn();
    component.activate.subscribe(activate);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    expect(activate).toHaveBeenCalledOnce();

    component.busy = true;
    fixture.detectChanges();
    button.click();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(activate).toHaveBeenCalledOnce();
  });
});
