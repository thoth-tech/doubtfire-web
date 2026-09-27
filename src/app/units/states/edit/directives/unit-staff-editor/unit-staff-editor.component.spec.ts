import {afterEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelect, MatSelectModule} from '@angular/material/select';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatTableModule} from '@angular/material/table';
import {MatTooltipModule} from '@angular/material/tooltip';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {of} from 'rxjs';
import {UnitService} from 'src/app/api/models/doubtfire-model';
import {Unit} from 'src/app/api/models/unit';
import {UnitRole} from 'src/app/api/models/unit-role';
import {UnitRoleService} from 'src/app/api/services/unit-role.service';
import {UserService} from 'src/app/api/services/user.service';
import {EmptyStateComponent} from 'src/app/common/empty-state/empty-state.component';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {CsvResultModalService} from 'src/app/common/modals/csv-result-modal/csv-result-modal.service';
import {TutorNotesModalService} from 'src/app/common/modals/tutor-notes-modal/tutor-notes-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {BulkImportStaffModalService} from './bulk-import-staff-modal/bulk-import-staff-modal.service';
import {UnitStaffEditorComponent} from './unit-staff-editor.component';

function role(id: number, name: string, extra: Partial<UnitRole> = {}): UnitRole {
  return Object.assign(new UnitRole(), {
    id,
    role: 'Tutor',
    user: {id: id * 10, name, displayName: name, email: `${name.toLowerCase()}@uni.edu`},
    ...extra,
  });
}

function unitWith(staff: UnitRole[], mainConvenor?: UnitRole): Unit {
  const unit = Object.assign(new Unit(), {id: 3, code: 'SIT101', name: 'Intro to Things'});
  staff.forEach((unitRole) => unit.staffCache.add(unitRole));
  unit.mainConvenor = mainConvenor;
  return unit;
}

function mocks(currentUserId = 999) {
  return {
    alerts: {success: vi.fn(), error: vi.fn()},
    unitRoleService: {update: vi.fn(() => of({})), delete: vi.fn(() => of(true))},
    userService: {currentUser: {id: currentUserId}},
    confirmationModal: {show: vi.fn()},
    unitService: {update: vi.fn(() => of({}))},
  };
}

// Built directly for the handlers, and through TestBed for the one template case.
function editorFor(unit: Unit, currentUserId?: number) {
  const m = mocks(currentUserId);
  const component = new UnitStaffEditorComponent(
    m.alerts as never,
    m.unitRoleService as never,
    m.userService as never,
    m.confirmationModal as never,
    {} as never, // tutorNotesModal
    {} as never, // bulkImportStaffModal
    {} as never, // csvResultModal
    m.unitService as never,
  );
  component.unit = unit;
  component.staff = [];
  component.ngOnInit();
  return {component, ...m};
}

describe('UnitStaffEditorComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  // The observer switch read unit.mainConvenor.id, which threw for a unit with no
  // main convenor and left the whole table blank.
  it('shows the staff of a unit that has no main convenor', async () => {
    const m = mocks();
    const unit = unitWith([role(1, 'Ada'), role(2, 'Grace', {role: 'Convenor'})]);

    await TestBed.configureTestingModule({
      declarations: [UnitStaffEditorComponent],
      imports: [
        FormsModule,
        MatAutocompleteModule,
        MatButtonToggleModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatTableModule,
        MatTooltipModule,
        NoopAnimationsModule,
        EmptyStateComponent,
      ],
      providers: [
        {provide: AlertService, useValue: m.alerts},
        {provide: UnitRoleService, useValue: m.unitRoleService},
        {provide: UserService, useValue: m.userService},
        {provide: ConfirmationModalService, useValue: m.confirmationModal},
        {provide: TutorNotesModalService, useValue: {}},
        {provide: BulkImportStaffModalService, useValue: {}},
        {provide: CsvResultModalService, useValue: {}},
        {provide: UnitService, useValue: m.unitService},
      ],
      // user-icon draws an avatar and is not what this checks.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(UnitStaffEditorComponent);
    fixture.componentInstance.unit = unit;
    fixture.componentInstance.staff = [];
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tr.mat-mdc-row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Ada');
    // The convenor can be made main, and nobody is marked as main yet.
    const mainCells: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('td.mat-column-main-convenor'),
    );
    expect(mainCells.map((cell) => cell.textContent.trim())).toEqual(['', 'Make main']);
    // Every icon-only button says what it does.
    fixture.nativeElement.querySelectorAll('button[mat-icon-button]').forEach((button) => {
      expect(button.getAttribute('aria-label')).toBeTruthy();
    });
    // no mentor is a null option, so the select has to let you pick it
    const mentorSelects = fixture.debugElement.queryAll(By.directive(MatSelect));
    expect(mentorSelects.length).toBe(2);
    mentorSelects.forEach((select) => {
      expect(select.componentInstance.canSelectNullableOptions).toBe(true);
    });
  });

  it('knows who the main convenor is, and that there may be none', () => {
    const grace = role(2, 'Grace', {role: 'Convenor'});
    const {component} = editorFor(unitWith([role(1, 'Ada'), grace]));

    expect(component.isMainConvenor(grace)).toBe(false);

    component.unit.mainConvenor = grace;
    expect(component.isMainConvenor(grace)).toBe(true);
  });

  it('offers everyone else as a mentor', () => {
    const ada = role(1, 'Ada');
    const grace = role(2, 'Grace');
    const {component} = editorFor(unitWith([ada, grace]));

    expect(component.mentorOptions(ada).map((option) => option.id)).toEqual([2]);
  });

  // Older data can have someone set as their own mentor. They stay listed for that
  // person so the field shows who it is rather than going blank.
  it('keeps someone listed as their own mentor when the data says so', () => {
    const ada = role(1, 'Ada', {mentorId: 1});
    const grace = role(2, 'Grace');
    const {component} = editorFor(unitWith([ada, grace]));

    expect(component.mentorOptions(ada).map((option) => option.id)).toEqual([1, 2]);
  });

  // "(None)" used to send an empty string rather than clearing the mentor.
  it('clears a mentor with null', () => {
    const ada = role(1, 'Ada', {mentorId: 2});
    const {component, unitRoleService} = editorFor(unitWith([ada, role(2, 'Grace')]));

    component.selectMentor(ada, {value: null} as never);

    expect(ada.mentorId).toBeNull();
    expect(unitRoleService.update).toHaveBeenCalledWith(ada);
  });

  // Changing the convenor went through a whole-unit update, which also sent any other
  // field of the unit that no longer matched what was first loaded.
  it('sends only the new main convenor', () => {
    const grace = role(2, 'Grace', {role: 'Convenor'});
    const {component, confirmationModal, unitService} = editorFor(unitWith([grace]));

    component.changeMainConvenor(grace);
    (confirmationModal.show.mock.calls[0][2] as () => void)();

    expect(unitService.update).toHaveBeenCalledWith(component.unit, {
      body: {unit: {main_convenor_id: 2}},
    });
    expect(component.unit.mainConvenor).toBe(grace);
  });

  it('puts the old main convenor back when the change is refused', () => {
    const ada = role(1, 'Ada', {role: 'Convenor'});
    const grace = role(2, 'Grace', {role: 'Convenor'});
    const {component, confirmationModal, unitService, alerts} = editorFor(
      unitWith([ada, grace], ada),
    );
    unitService.update.mockReturnValue({
      subscribe: ({error}: {error: (message: string) => void}) => error('Not allowed'),
    } as never);

    component.changeMainConvenor(grace);
    (confirmationModal.show.mock.calls[0][2] as () => void)();

    expect(component.unit.mainConvenor).toBe(ada);
    expect(alerts.error).toHaveBeenCalledWith('Not allowed', 6000);
  });

  // The reassign button always said "Reassign to me", even when the tutorials were
  // going to the main convenor instead.
  it('names who the tutorials go to when a tutor is removed', () => {
    const ada = role(1, 'Ada');
    const grace = role(2, 'Grace', {role: 'Convenor'});
    const unit = unitWith([ada, grace], grace);
    unit.tutorialsCache.add(Object.assign({key: 5, abbreviation: 'LA1-01', tutor: ada.user}));
    const {component, confirmationModal} = editorFor(unit, 999);

    component.removeStaff(ada);

    const [, message, , , confirmText] = confirmationModal.show.mock.calls[0];
    expect(message).toContain('LA1-01');
    expect(message).toContain('Grace');
    expect(confirmText).toBe('Remove and give them to Grace');
  });

  it('offers the tutorials to the person removing the tutor when they teach the unit', () => {
    const ada = role(1, 'Ada');
    const me = role(2, 'Grace', {role: 'Convenor'});
    const unit = unitWith([ada, me], me);
    unit.tutorialsCache.add(Object.assign({key: 5, abbreviation: 'LA1-01', tutor: ada.user}));
    const {component, confirmationModal} = editorFor(unit, me.user.id);

    component.removeStaff(ada);

    expect(confirmationModal.show.mock.calls[0][4]).toBe('Remove and give them to me');
  });
});

it('sets a selected mentor id without changing the unit role', () => {
  const ada = role(1, 'Ada');
  const {component, unitRoleService} = editorFor(unitWith([ada, role(2, 'Grace')]));
  component.selectMentor(ada, {value: 2} as never);
  expect(ada.mentorId).toBe(2);
  expect(unitRoleService.update).toHaveBeenCalledWith(ada);
});
