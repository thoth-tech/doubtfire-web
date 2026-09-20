import {EmojiSearch} from '@ctrl/ngx-emoji-mart';
import {beforeEach, describe, expect, it} from 'vitest';
import {CommonModule} from '@angular/common';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {TaskCommentService, UserService} from 'src/app/api/models/doubtfire-model';
import {AlertService} from 'src/app/common/services/alert.service';
import {EmojiService} from 'src/app/common/services/emoji.service';
import {TaskCommentsViewerComponent} from '../task-comments-viewer/task-comments-viewer.component';
import {TaskCommentComposerComponent} from './task-comment-composer.component';

function memoryStorage(): Storage {
  const values: Map<string, string> = new Map();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, String(value)),
  };
}

describe('TaskCommentComposerComponent phone actions', () => {
  let fixture: ComponentFixture<TaskCommentComposerComponent>;

  beforeEach(async () => {
    // Node exposes storage globals without values unless it is launched with storage files.
    // Use isolated browser-compatible stores while rendering this storage-aware component.
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: memoryStorage(),
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: memoryStorage(),
    });

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [TaskCommentComposerComponent],
      providers: [
        provideNoopAnimations(),
        {provide: MatDialog, useValue: {}},
        {provide: EmojiSearch, useValue: {}},
        {provide: EmojiService, useValue: {}},
        {provide: TaskCommentsViewerComponent, useValue: {}},
        {provide: AlertService, useValue: {}},
        {provide: TaskCommentService, useValue: {}},
        {provide: UserService, useValue: {currentUser: {id: 1}}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskCommentComposerComponent);
    fixture.componentRef.setInput('task', {
      id: 123,
      unit: {currentUserIsStaff: false},
    });
    fixture.componentRef.setInput('sharedData', {
      originalComment: null,
      editingComment: null,
    });
    fixture.detectChanges();
  });

  const componentStyles = (): string =>
    (
      TaskCommentComposerComponent as unknown as {
        ɵcmp: {styles: string[]};
      }
    ).ɵcmp.styles.join('\n');

  it('keeps clear accessible names on the attachment and microphone controls', () => {
    const attach = fixture.nativeElement.querySelector(
      'button[aria-label="Attach a file"]',
    ) as HTMLButtonElement;
    const record = fixture.nativeElement.querySelector(
      'button[aria-label="Record audio feedback"]',
    ) as HTMLButtonElement;

    expect(attach).toBeTruthy();
    expect(record).toBeTruthy();
    expect(attach.classList).toContain('composer-touch-action');
    expect(record.classList).toContain('composer-touch-action');
  });

  it('gives both phone controls 48px touch targets without changing their desktop rule', () => {
    const styles = componentStyles();
    const phoneMediaStart = styles.indexOf('@media (max-width: 639.98px)');
    const desktopStyles = styles.slice(0, phoneMediaStart);
    const phoneStyles = styles.slice(phoneMediaStart);

    expect(phoneMediaStart).toBeGreaterThan(-1);
    expect(desktopStyles).not.toContain('composer-touch-action');
    expect(phoneStyles).toMatch(/min-width:\s*48px/);
    expect(phoneStyles).toMatch(/min-height:\s*48px/);
    expect(phoneStyles).toMatch(/width:\s*48px/);
    expect(phoneStyles).toMatch(/height:\s*48px/);
    expect(phoneStyles).toMatch(/transform:\s*none/);
    expect(phoneStyles).toMatch(/border:\s*1px solid #cbd5e1/);
    expect(phoneStyles).toMatch(/background-color:\s*#f8fafc/);
  });

  it('keeps the phone composer away from both safe-area edges', () => {
    const styles = componentStyles();
    const phoneStyles = styles.slice(styles.indexOf('@media (max-width: 639.98px)'));

    expect(phoneStyles).toMatch(/padding-left:\s*max\(8px,\s*env\(safe-area-inset-left\)\)/);
    expect(phoneStyles).toMatch(/padding-right:\s*max\(8px,\s*env\(safe-area-inset-right\)\)/);
  });
});
