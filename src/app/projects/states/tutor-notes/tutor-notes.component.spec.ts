import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatChipSelectionChange} from '@angular/material/chips';
import {EMPTY, of, throwError} from 'rxjs';
import {Task, UserService} from 'src/app/api/models/doubtfire-model';
import {TutorNote} from 'src/app/api/models/tutor-note';
import {TutorNoteService} from 'src/app/api/services/tutor-note.service';
import {EmptyStateComponent} from 'src/app/common/empty-state/empty-state.component';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {HumanizedDatePipe} from 'src/app/common/pipes/humanized-date.pipe';
import {LocalizedDatePipe} from 'src/app/common/pipes/localized-date.pipe';
import {MarkedPipe} from 'src/app/common/pipes/marked.pipe';
import {AlertService} from 'src/app/common/services/alert.service';
import {TutorNotesComponent} from './tutor-notes.component';

const emptyProvider = {};
const tutorNoteServiceStub = {
  loadTutorNotes: () => EMPTY,
  updateTutorNoteReplies: () => undefined,
};

describe('TutorNotesComponent', () => {
  let component: TutorNotesComponent;
  let fixture: ComponentFixture<TutorNotesComponent>;
  let note: TutorNote;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TutorNotesComponent, HumanizedDatePipe, LocalizedDatePipe, MarkedPipe],
      providers: [
        {provide: UserService, useValue: emptyProvider},
        {provide: TutorNoteService, useValue: tutorNoteServiceStub},
        {provide: AlertService, useValue: emptyProvider},
        {provide: ConfirmationModalService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TutorNotesComponent);
    component = fixture.componentInstance;
    note = {
      id: 3,
      replyToId: null,
      note: 'a tutor note',
      user: {},
      authorIsMe: true,
      noteIsForMe: true,
      readByUnitRole: false,
    } as TutorNote;
    component.unitRole = {tutorNotesCache: {currentValues: [note]}} as never;

    fixture.detectChanges();
    component.loadingTutorNotes = false;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  function card(): HTMLElement {
    return fixture.nativeElement.querySelector('.note-card') as HTMLElement;
  }

  function editButton(): HTMLButtonElement {
    return card().querySelector('.note-actions button') as HTMLButtonElement;
  }

  it('renders the note actions instead of gating them behind a pointer flag', () => {
    const actions = card().querySelector('.note-actions') as HTMLElement;

    expect(actions).toBeTruthy();
    expect(actions.hasAttribute('hidden')).toBe(false);
  });

  it('builds the actions out of real buttons rather than bare icons', () => {
    const buttons = card().querySelectorAll('.note-actions button');

    expect(buttons.length).toBe(3);
    expect(editButton().getAttribute('aria-label')).toBe('Edit this note');
  });

  it('does not meet the reveal condition while nothing in the note has focus', () => {
    expect(card().matches(':focus-within')).toBe(false);
  });

  it('meets the reveal condition once the keyboard reaches the actions', () => {
    editButton().focus();

    expect(document.activeElement).toBe(editButton());
    expect(card().matches(':focus-within')).toBe(true);
  });

  it('opens the editor through the button the pointer uses, not through injected state', () => {
    const button = editButton();
    button.focus();
    button.click();
    fixture.detectChanges();

    expect(component.editingNote).toBe(note);
    expect(card().querySelector('textarea')).toBeTruthy();
  });

  it('keeps Mark as read outside the note actions', () => {
    const markAsRead = Array.from<HTMLButtonElement>(card().querySelectorAll('button')).find(
      (button) => button.textContent.trim() === 'Mark as read',
    );

    expect(markAsRead).toBeDefined();
    expect(markAsRead.closest('.note-actions')).toBeNull();
  });
});

describe('TutorNotesComponent states', () => {
  let component: TutorNotesComponent;
  let fixture: ComponentFixture<TutorNotesComponent>;
  let loadTutorNotes: ReturnType<typeof vi.fn>;
  let addNote: ReturnType<typeof vi.fn>;

  const otherTaskNote = {
    id: 4,
    replyToId: null,
    note: 'a note on another task',
    user: {},
    authorIsMe: false,
    taskDefinition: {abbreviation: 'T2', name: 'Second task'},
  } as TutorNote;

  beforeEach(async () => {
    loadTutorNotes = vi.fn(() => of([]));
    addNote = vi.fn(() => EMPTY);

    await TestBed.configureTestingModule({
      declarations: [TutorNotesComponent, HumanizedDatePipe, LocalizedDatePipe, MarkedPipe],
      // The real button, so disabledInteractive behaves as it does in the app.
      imports: [EmptyStateComponent, MatButtonModule],
      providers: [
        {provide: UserService, useValue: emptyProvider},
        {
          provide: TutorNoteService,
          useValue: {loadTutorNotes, addNote, updateTutorNoteReplies: () => undefined},
        },
        {provide: AlertService, useValue: emptyProvider},
        {provide: ConfirmationModalService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  // Opened from a task, the list starts filtered to that task.
  function render(notes: TutorNote[], task?: Task): void {
    fixture = TestBed.createComponent(TutorNotesComponent);
    component = fixture.componentInstance;
    component.task = task;
    component.unitRole = {tutorNotesCache: {currentValues: notes}} as never;
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  }

  function filters(): HTMLElement | null {
    return fixture.nativeElement.querySelector('mat-chip-listbox');
  }

  function userChange(selected: boolean): MatChipSelectionChange {
    return {isUserInput: true, selected} as MatChipSelectionChange;
  }

  it('says there are no moderation notes yet, without filters that would do nothing', () => {
    render([]);

    expect(text()).toContain('No moderation notes yet');
    expect(filters()).toBeNull();
    expect(fixture.nativeElement.querySelector('.note-card')).toBeNull();
  });

  it('explains an empty filter and offers the filters to widen it', () => {
    render([otherTaskNote], {definition: {abbreviation: 'T1'}} as Task);

    expect(text()).toContain('No notes for the selected tasks');
    expect(text()).not.toContain('No moderation notes yet');
    expect(filters()).not.toBeNull();

    component.onFilterChange('all', userChange(true));
    fixture.detectChanges();

    expect(text()).not.toContain('No notes for the selected tasks');
    expect(fixture.nativeElement.querySelectorAll('.note-card').length).toBe(1);
  });

  it('only follows filter changes the user made', () => {
    render([otherTaskNote], {definition: {abbreviation: 'T1'}} as Task);

    component.onFilterChange('T1', {isUserInput: false, selected: false} as MatChipSelectionChange);
    expect(component.selectedTaskDefinitions.get('T1')).toBe(true);

    component.onFilterChange('T1', userChange(false));
    expect(component.selectedTaskDefinitions.get('T1')).toBe(false);
  });

  it('shows an error state with Try again when the notes fail to load', () => {
    loadTutorNotes.mockReturnValueOnce(throwError(() => new Error('offline')));
    render([]);

    expect(text()).toContain('The notes did not load');

    const tryAgain = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => button.textContent.trim() === 'Try again');
    tryAgain.click();
    fixture.detectChanges();

    expect(loadTutorNotes).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain('The notes did not load');
    expect(text()).toContain('No moderation notes yet');
  });

  it('puts Submit outside the text field, focusable but inactive until there is text', () => {
    render([]);
    const submit = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find(
      (button) =>
        (button.querySelector('.mdc-button__label') ?? button).textContent.trim() === 'Submit',
    );

    expect(submit.closest('mat-form-field')).toBeNull();
    expect(submit.querySelector('mat-icon')?.textContent.trim()).toBe('save');
    expect(submit.hasAttribute('disabled')).toBe(false);
    expect(submit.getAttribute('aria-disabled')).toBe('true');

    submit.click();
    expect(addNote).not.toHaveBeenCalled();

    component.noteText = 'Can we talk about this mark?';
    fixture.detectChanges();
    expect(submit.getAttribute('aria-disabled')).toBeNull();
  });
});
