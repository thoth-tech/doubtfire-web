import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {EMPTY, Subject, of, throwError} from 'rxjs';
import {UserService} from 'src/app/api/models/doubtfire-model';
import {StaffNote} from 'src/app/api/models/staff-note';
import {StaffNoteService} from 'src/app/api/services/staff-note.service';
import {EmptyStateComponent} from 'src/app/common/empty-state/empty-state.component';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {HumanizedDatePipe} from 'src/app/common/pipes/humanized-date.pipe';
import {LocalizedDatePipe} from 'src/app/common/pipes/localized-date.pipe';
import {MarkedPipe} from 'src/app/common/pipes/marked.pipe';
import {AlertService} from 'src/app/common/services/alert.service';
import {StaffNotesComponent} from './staff-notes.component';

const emptyProvider = {};
const staffNoteServiceStub = {
  loadStaffNotes: () => EMPTY,
  updateStaffNoteReplies: () => undefined,
};

describe('StaffNotesComponent', () => {
  let component: StaffNotesComponent;
  let fixture: ComponentFixture<StaffNotesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StaffNotesComponent, HumanizedDatePipe, LocalizedDatePipe, MarkedPipe],
      providers: [
        {provide: UserService, useValue: emptyProvider},
        {provide: StaffNoteService, useValue: staffNoteServiceStub},
        {provide: AlertService, useValue: emptyProvider},
        {provide: ConfirmationModalService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(StaffNotesComponent, {set: {template: ''}})
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StaffNotesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('StaffNotesComponent note actions', () => {
  let component: StaffNotesComponent;
  let fixture: ComponentFixture<StaffNotesComponent>;
  let note: StaffNote;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StaffNotesComponent, HumanizedDatePipe, LocalizedDatePipe, MarkedPipe],
      providers: [
        {provide: UserService, useValue: emptyProvider},
        {provide: StaffNoteService, useValue: staffNoteServiceStub},
        {provide: AlertService, useValue: emptyProvider},
        {provide: ConfirmationModalService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StaffNotesComponent);
    component = fixture.componentInstance;
    note = {id: 7, replyToId: null, note: 'a note', user: {}, authorIsMe: true} as StaffNote;

    fixture.detectChanges();
    component.loadingStaffNotes = false;
    component.project = {
      student: {preferredName: 'Ada', lastName: 'Lovelace', displayName: 'Ada Lovelace'},
      staffNoteCache: {currentValues: [note]},
    } as never;
    fixture.detectChanges();
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

describe('StaffNotesComponent states', () => {
  let component: StaffNotesComponent;
  let fixture: ComponentFixture<StaffNotesComponent>;
  let loadStaffNotes: ReturnType<typeof vi.fn>;
  let addNote: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    loadStaffNotes = vi.fn(() => of([]));
    addNote = vi.fn(() => EMPTY);

    await TestBed.configureTestingModule({
      declarations: [StaffNotesComponent, HumanizedDatePipe, LocalizedDatePipe, MarkedPipe],
      // The real button, so disabledInteractive behaves as it does in the app.
      imports: [EmptyStateComponent, MatButtonModule],
      providers: [
        {provide: UserService, useValue: emptyProvider},
        {
          provide: StaffNoteService,
          useValue: {loadStaffNotes, addNote, updateStaffNoteReplies: () => undefined},
        },
        {provide: AlertService, useValue: emptyProvider},
        {provide: ConfirmationModalService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  function projectFor(name: string): never {
    return {student: {name}, staffNoteCache: {currentValues: []}} as never;
  }

  function render(): void {
    fixture = TestBed.createComponent(StaffNotesComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('project', projectFor('Ada Lovelace'));
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  }

  function buttonLabelled(label: string): HTMLButtonElement | undefined {
    return Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => labelOf(button) === label,
    );
  }

  // The button's own label, without the text of an icon beside it.
  function labelOf(button: HTMLButtonElement): string {
    return (button.querySelector('.mdc-button__label') ?? button).textContent.trim();
  }

  it('says there are no notes yet once an empty list loads', () => {
    render();

    expect(text()).toContain('No notes yet');
    expect(text()).toContain('Notes you add below are only seen by staff.');
    expect(fixture.nativeElement.querySelector('.note-card')).toBeNull();
  });

  it('shows an error state with Try again when the notes fail to load', () => {
    loadStaffNotes.mockReturnValueOnce(throwError(() => new Error('offline')));
    render();

    expect(text()).toContain('The notes did not load');
    expect(text()).not.toContain('No notes yet');

    buttonLabelled('Try again').click();
    fixture.detectChanges();

    expect(loadStaffNotes).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain('The notes did not load');
    expect(text()).toContain('No notes yet');
  });

  it('keeps Save note focusable but inactive until there is something to save', () => {
    render();
    const save = buttonLabelled('Save note');

    expect(save.getAttribute('type')).toBe('button');
    expect(save.classList).toContain('mat-mdc-unelevated-button');
    expect(save.querySelector('mat-icon')?.textContent.trim()).toBe('save');
    expect(save.hasAttribute('disabled')).toBe(false);
    expect(save.getAttribute('aria-disabled')).toBe('true');

    component.noteText = '   ';
    fixture.detectChanges();
    save.click();
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(addNote).not.toHaveBeenCalled();

    component.noteText = 'Talked about the extension';
    fixture.detectChanges();
    expect(save.getAttribute('aria-disabled')).toBeNull();
  });

  it('labels the note field and lets it grow from two to eight rows', () => {
    render();
    const field = fixture.nativeElement.querySelector('textarea[cdkTextareaAutosize]');

    expect(field.closest('mat-form-field').textContent).toContain('Add a note');
    expect(field.getAttribute('cdkAutosizeMinRows')).toBe('2');
    expect(field.getAttribute('cdkAutosizeMaxRows')).toBe('8');
  });

  it('drops a reply, an edit and a draft meant for the previous student', () => {
    render();
    component.replyingToNote = {id: 1} as StaffNote;
    component.editingNote = {id: 2} as StaffNote;
    component.noteText = 'A draft about Ada';

    fixture.componentRef.setInput('project', projectFor('Grace Hopper'));
    fixture.detectChanges();

    expect(component.replyingToNote).toBeNull();
    expect(component.editingNote).toBeNull();
    expect(component.noteText).toBe('');
    expect(loadStaffNotes).toHaveBeenCalledTimes(2);
  });

  it('ignores a load for the previous student that finishes late', () => {
    const late: Subject<StaffNote[]> = new Subject();
    loadStaffNotes.mockReturnValueOnce(late);
    render();

    fixture.componentRef.setInput('project', projectFor('Grace Hopper'));
    fixture.detectChanges();
    late.error(new Error('offline'));
    fixture.detectChanges();

    expect(text()).not.toContain('The notes did not load');
    expect(text()).toContain('No notes yet');
  });
});
