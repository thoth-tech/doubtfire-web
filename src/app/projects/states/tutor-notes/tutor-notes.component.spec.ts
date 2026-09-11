import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {EMPTY} from 'rxjs';
import {UserService} from 'src/app/api/models/doubtfire-model';
import {TutorNote} from 'src/app/api/models/tutor-note';
import {TutorNoteService} from 'src/app/api/services/tutor-note.service';
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
});
