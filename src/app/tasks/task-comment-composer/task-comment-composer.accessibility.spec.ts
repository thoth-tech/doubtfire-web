import {EmojiSearch} from '@ctrl/ngx-emoji-mart';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CommonModule} from '@angular/common';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {of} from 'rxjs';
import {TaskCommentService, UserService} from 'src/app/api/models/doubtfire-model';
import {AlertService} from 'src/app/common/services/alert.service';
import {EmojiService} from 'src/app/common/services/emoji.service';
import {expectAccessible} from 'src/app/common/testing/accessibility';
import {TaskCommentsViewerComponent} from '../task-comments-viewer/task-comments-viewer.component';
import {TaskCommentComposerComponent} from './task-comment-composer.component';

describe('Shared task comment controls', () => {
  let fixture: ComponentFixture<TaskCommentComposerComponent>;

  beforeEach(async () => {
    for (const name of ['localStorage', 'sessionStorage']) {
      vi.stubGlobal(name, {getItem: () => null, setItem: vi.fn(), removeItem: vi.fn()});
    }
    await TestBed.configureTestingModule({
      imports: [CommonModule, MatButtonModule],
      declarations: [TaskCommentComposerComponent],
      providers: [
        provideNoopAnimations(),
        {provide: MatDialog, useValue: {}},
        {provide: EmojiSearch, useValue: {}},
        {provide: EmojiService, useValue: {}},
        {provide: TaskCommentsViewerComponent, useValue: {scrollDown: vi.fn()}},
        {provide: AlertService, useValue: {}},
        {
          provide: TaskCommentService,
          useValue: {
            attachmentPolicy: () =>
              of({
                version: 1,
                max_bytes_exclusive: 10_000_000,
                max_selection_count: 5,
                categories: [{id: 'pdf', name: 'PDF', extensions: ['pdf'], preview: 'pdf'}],
              }),
          },
        },
        {provide: UserService, useValue: {currentUser: {id: 1}}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(TaskCommentComposerComponent);
    fixture.componentRef.setInput('task', {id: 123, unit: {currentUserIsStaff: false}});
    fixture.componentRef.setInput('sharedData', {originalComment: null, editingComment: null});
    fixture.detectChanges();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('passes automated accessibility checks for student and staff feedback controls', async () => {
    await fixture.whenStable();
    await expectAccessible(fixture.nativeElement);
    fixture.componentRef.setInput('task', {id: 456, unit: {currentUserIsStaff: true}});
    fixture.detectChanges();
    await fixture.whenStable();
    await expectAccessible(fixture.nativeElement);
  });

  it('exposes a named multiline textbox and removes it from focus while recording', () => {
    const editor = fixture.nativeElement.querySelector('[role="textbox"]') as HTMLElement;
    expect(editor.getAttribute('aria-label')).toBe('Task comment');
    expect(editor.getAttribute('aria-multiline')).toBe('true');
    expect(editor.tabIndex).toBe(0);
    editor.focus();
    expect(document.activeElement).toBe(editor);
    fixture.componentInstance.recording = true;
    fixture.detectChanges();
    expect(editor.hidden).toBe(true);
    expect(editor.tabIndex).toBe(-1);
    expect(editor.getAttribute('aria-disabled')).toBe('true');
  });

  it('uses a focusable native button to open and close emoji choices once per activation', () => {
    const button = fixture.nativeElement.querySelector(
      'button[aria-label="Choose an emoji"]',
    ) as HTMLButtonElement;
    expect(button.type).toBe('button');
    expect(button.tabIndex).toBe(0);
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the staff feedback template action hidden from students', () => {
    const button = fixture.nativeElement.querySelector(
      'button[aria-label="Choose feedback templates"]',
    ) as HTMLButtonElement;
    expect(button.closest('[hidden]')).toBeTruthy();
    fixture.componentRef.setInput('task', {id: 456, unit: {currentUserIsStaff: true}});
    fixture.detectChanges();
    expect(button.closest('[hidden]')).toBeNull();
    const open = vi.spyOn(fixture.componentInstance, 'showFeedbackPicker');
    button.click();
    fixture.detectChanges();
    expect(open).toHaveBeenCalledOnce();
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });
});
