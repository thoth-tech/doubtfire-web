import {EmojiSearch} from '@ctrl/ngx-emoji-mart';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CommonModule} from '@angular/common';
import {ElementRef, NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatDialog} from '@angular/material/dialog';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {NavigationStart, Router} from '@angular/router';
import {Subject, of} from 'rxjs';
import {TaskCommentService, UserService} from 'src/app/api/models/doubtfire-model';
import {AlertService} from 'src/app/common/services/alert.service';
import {EmojiService} from 'src/app/common/services/emoji.service';
import {FeedbackDraftStore} from 'src/app/common/services/feedback-draft-store.service';
import {ThemeService} from 'src/app/common/theme/theme.service';
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
  let routerEvents: Subject<unknown>;
  let taskCommentService: {
    addComment: ReturnType<typeof vi.fn>;
    editComment: ReturnType<typeof vi.fn>;
    uploadStagedAttachment: ReturnType<typeof vi.fn>;
    attachmentPolicy: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    routerEvents = new Subject();
    taskCommentService = {
      addComment: vi.fn(() => of({id: 1})),
      editComment: vi.fn(() => of({id: 1})),
      uploadStagedAttachment: vi.fn(() => of({state: 'complete', progress: 100})),
      attachmentPolicy: vi.fn(() =>
        of({
          version: 1,
          categories: [],
          max_bytes_exclusive: 30_000_000,
          max_selection_count: 5,
        }),
      ),
    };
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
      imports: [CommonModule, FormsModule],
      declarations: [TaskCommentComposerComponent],
      providers: [
        provideNoopAnimations(),
        {provide: MatDialog, useValue: {}},
        {provide: EmojiSearch, useValue: {search: vi.fn(() => [])}},
        {
          provide: EmojiService,
          useValue: {nativeEmojiToColons: vi.fn((text: string) => text)},
        },
        {provide: TaskCommentsViewerComponent, useValue: {scrollDown: vi.fn()}},
        {provide: AlertService, useValue: {}},
        {provide: TaskCommentService, useValue: taskCommentService},
        {provide: UserService, useValue: {currentUser: {id: 1}}},
        {provide: Router, useValue: {events: routerEvents.asObservable()}},
        {provide: FeedbackDraftStore, useFactory: () => new FeedbackDraftStore()},
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

  const textarea = (): HTMLTextAreaElement =>
    fixture.nativeElement.querySelector(
      'textarea[aria-label="Task comment"]',
    ) as HTMLTextAreaElement;

  const sendButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('button[aria-label="Send message"]') as HTMLButtonElement;

  const emojiButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector(
      'button[aria-label="Choose an emoji"]',
    ) as HTMLButtonElement;

  const enterText = (text: string): void => {
    textarea().value = text;
    textarea().dispatchEvent(new Event('input', {bubbles: true}));
    fixture.detectChanges();
  };

  // jsdom has no implicit submission, so this does what a browser does when Enter
  // is pressed in a single-line field: click the form's default button if it has
  // one, otherwise submit only when no other field blocks it.
  const pressEnterIn = (field: HTMLInputElement): void => {
    const enter = new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key: 'Enter'});
    field.dispatchEvent(enter);
    const form = field.form;
    if (enter.defaultPrevented || !form) {
      return;
    }

    const controls = Array.from(form.elements);
    const defaultButton = controls.find(
      (control) =>
        (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) &&
        control.type === 'submit',
    ) as HTMLButtonElement | HTMLInputElement | undefined;
    if (defaultButton) {
      if (!defaultButton.disabled) {
        defaultButton.click();
      }
      return;
    }

    const blockingFields = controls.filter(
      (control) =>
        control instanceof HTMLInputElement &&
        ['text', 'search', 'url', 'tel', 'email', 'password', 'number'].includes(control.type),
    );
    if (blockingFields.length === 1) {
      form.requestSubmit();
    }
  };

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

  it('uses a labelled multiline textarea and an explicit visible Send button', () => {
    expect(textarea()).toBeTruthy();
    expect(textarea().placeholder).toBe('Write a message...');
    expect(textarea().getAttribute('enterkeyhint')).toBe('enter');
    expect(textarea().rows).toBe(1);
    expect(sendButton()).toBeTruthy();
    expect(sendButton().textContent?.trim()).toBe('Send');
    expect(sendButton().disabled).toBe(true);
  });

  it('keeps attachment left of the field and microphone, emoji, and Send to its right', () => {
    const orderedControls = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.composer-container button, .composer-container textarea',
      ),
    ) as HTMLElement[];
    // Staff tools stay in the page for students but hidden, so only count what is shown.
    const labels = orderedControls
      .filter((element) => element.closest('[hidden]') === null)
      .map((element) => element.getAttribute('aria-label'));

    expect(labels).toEqual([
      'Attach a file',
      'Task comment',
      'Record audio feedback',
      'Choose an emoji',
      'Send message',
    ]);
  });

  it('leaves Enter available for a new line instead of sending', () => {
    enterText('First paragraph');
    const enter = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
    });

    textarea().dispatchEvent(enter);

    expect(enter.defaultPrevented).toBe(false);
    expect(taskCommentService.addComment).not.toHaveBeenCalled();
  });

  it.each([
    ['emoji search', '#feedback-emoji-picker', 'search'],
    ['feedback template search', 'f-task-feedback-templates', 'text'],
  ])(
    'does not send a half-written message on Enter in the %s box',
    (_name, hostSelector, inputType) => {
      enterText('Half-written feedback');
      const host = fixture.nativeElement.querySelector(hostSelector) as HTMLElement;
      // Stands in for the search field the picker renders inside the composer form.
      const search = document.createElement('input');
      search.type = inputType;
      host.appendChild(search);

      pressEnterIn(search);
      fixture.detectChanges();

      expect(taskCommentService.addComment).not.toHaveBeenCalled();
      expect(textarea().value).toBe('Half-written feedback');
    },
  );

  it('does not send when a button without a type inside the composer is clicked', () => {
    enterText('Half-written feedback');
    // The audio recorder renders its start, stop and play buttons with no type.
    const recorderButton = document.createElement('button');
    fixture.nativeElement.querySelector('#textFieldContainer').appendChild(recorderButton);

    recorderButton.click();
    fixture.detectChanges();

    expect(taskCommentService.addComment).not.toHaveBeenCalled();
  });

  it('prevents whitespace sends and sends non-empty text only from the explicit action', () => {
    enterText('   \n  ');
    expect(sendButton().disabled).toBe(true);
    sendButton().click();
    expect(taskCommentService.addComment).not.toHaveBeenCalled();

    enterText('First line\nSecond line');
    expect(sendButton().disabled).toBe(false);
    sendButton().click();

    expect(taskCommentService.addComment).toHaveBeenCalledOnce();
    expect(taskCommentService.addComment).toHaveBeenCalledWith(
      fixture.componentInstance.task,
      'First line\nSecond line',
      'text',
      null,
      undefined,
      expect.any(String),
    );
  });

  it('disables Send while the request is in flight', () => {
    const response: Subject<{id: number}> = new Subject();
    taskCommentService.addComment.mockReturnValue(response);
    enterText('Please send this once');

    sendButton().click();
    fixture.detectChanges();

    expect(taskCommentService.addComment).toHaveBeenCalledOnce();
    expect(sendButton().disabled).toBe(true);
    expect(sendButton().textContent?.trim()).toBe('Sending…');
  });

  it('auto-grows to its cap and then scrolls inside the textarea', () => {
    Object.defineProperty(textarea(), 'scrollHeight', {configurable: true, value: 260});

    enterText('A long multiline message');

    expect(textarea().style.height).toBe('144px');
    expect(textarea().style.overflowY).toBe('auto');
  });

  it('keeps taps inside the emoji picker open and dismisses on an outside tap', () => {
    emojiButton().click();
    fixture.detectChanges();
    const picker = fixture.nativeElement.querySelector('.emoji-picker-host') as HTMLElement;

    picker.dispatchEvent(new Event('pointerdown', {bubbles: true}));
    expect(fixture.componentInstance.showEmojiPicker).toBe(true);

    document.body.dispatchEvent(new Event('pointerdown', {bubbles: true}));
    expect(fixture.componentInstance.showEmojiPicker).toBe(false);

    emojiButton().click();
    picker.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(fixture.componentInstance.showEmojiPicker).toBe(true);

    const backdrop = fixture.nativeElement.querySelector(
      '.emoji-picker-backdrop',
    ) as HTMLButtonElement;
    backdrop.click();
    expect(fixture.componentInstance.showEmojiPicker).toBe(false);
  });

  it('dismisses safely while an emoji ViewChild is between render states', () => {
    emojiButton().click();
    fixture.componentInstance.emojiPickerHost = new ElementRef<HTMLElement>(
      undefined as unknown as HTMLElement,
    );

    expect(() =>
      fixture.componentInstance.onDocumentPointerDown(new Event('pointerdown', {bubbles: true})),
    ).not.toThrow();
    expect(fixture.componentInstance.showEmojiPicker).toBe(false);
  });

  it('dismisses the emoji picker on Escape, route change, task change, and successful send', () => {
    emojiButton().click();
    document.dispatchEvent(
      new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key: 'Escape'}),
    );
    expect(fixture.componentInstance.showEmojiPicker).toBe(false);

    emojiButton().click();
    routerEvents.next(new NavigationStart(1, '/projects/1/dashboard/1.2P'));
    expect(fixture.componentInstance.showEmojiPicker).toBe(false);

    emojiButton().click();
    fixture.componentRef.setInput('task', {id: 124, unit: {currentUserIsStaff: false}});
    fixture.detectChanges();
    expect(fixture.componentInstance.showEmojiPicker).toBe(false);

    emojiButton().click();
    enterText('Send and close');
    sendButton().click();
    expect(fixture.componentInstance.showEmojiPicker).toBe(false);
  });

  it('updates the emoji picker when the resolved theme changes', () => {
    const theme = TestBed.inject(ThemeService);
    const picker = fixture.nativeElement.querySelector('emoji-mart') as HTMLElement & {
      darkMode: boolean;
    };

    theme.setPreference('dark');
    fixture.detectChanges();
    expect(picker.darkMode).toBe(true);

    theme.setPreference('light');
    fixture.detectChanges();
    expect(picker.darkMode).toBe(false);
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
    expect(phoneStyles).toMatch(/border:\s*1px solid var\(--ot-color-border\)/);
    expect(phoneStyles).toMatch(/background-color:\s*var\(--ot-color-surface-raised\)/);
  });

  it('keeps the phone composer away from both safe-area edges', () => {
    const styles = componentStyles();

    expect(styles).toContain('env(safe-area-inset-left)');
    expect(styles).toContain('env(safe-area-inset-right)');
    expect(styles).toContain('env(safe-area-inset-bottom)');
  });
});
