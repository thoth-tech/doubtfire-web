import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatTableModule} from '@angular/material/table';
import {Subject, of, throwError} from 'rxjs';
import {Group} from 'src/app/api/models/groups/group';
import {GroupSet} from 'src/app/api/models/groups/group-set';
import {Project} from 'src/app/api/models/project';
import {Tutorial} from 'src/app/api/models/tutorial/tutorial';
import {Unit} from 'src/app/api/models/unit';
import {UnitRole} from 'src/app/api/models/unit-role';
import {User} from 'src/app/api/models/user/user';
import {GroupService} from 'src/app/api/services/group.service';
import {UserService} from 'src/app/api/services/user.service';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GroupSelectorComponent} from './group-selector.component';

interface Fixture {
  unit: Unit;
  setA: GroupSet;
  setB: GroupSet;
  tutorial: Tutorial;
  untutored: Tutorial;
}

function user(id: number, name: string): User {
  const result = new User();
  result.id = id;
  result.firstName = name;
  result.lastName = '';
  return result;
}

function makeUnit(): Fixture {
  const unit = {id: 1} as unknown as Unit;

  const tutorial = new Tutorial(unit);
  tutorial.id = 10;
  tutorial.abbreviation = 'LA1';
  tutorial.tutor = user(5, 'Tess');

  // A tutorial nobody has been put in charge of yet.
  const untutored = new Tutorial(unit);
  untutored.id = 11;
  untutored.abbreviation = 'LA2';

  const setA = new GroupSet(unit);
  setA.id = 100;
  setA.name = 'Assignment 1';
  const setB = new GroupSet(unit);
  setB.id = 200;
  setB.name = 'Assignment 2';

  Object.assign(unit, {
    groupSets: [setA, setB],
    tutorials: [tutorial, untutored],
  });

  return {unit, setA, setB, tutorial, untutored};
}

function addGroup(set: GroupSet, id: number, name: string, tutorial?: Tutorial): Group {
  const group = new Group(set.unit);
  group.id = id;
  group.name = name;
  group.groupSet = set;
  group.tutorial = tutorial;
  group.capacityAdjustment = 0;
  set.groupsCache.add(group);
  return group;
}

describe('GroupSelectorComponent', () => {
  let groupService: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let confirmationModal: {show: ReturnType<typeof vi.fn>};

  function configure(template?: string) {
    groupService = {create: vi.fn(), delete: vi.fn(), update: vi.fn()};
    confirmationModal = {show: vi.fn()};

    const testBed = TestBed.configureTestingModule({
      declarations: [GroupSelectorComponent],
      imports: [
        FormsModule,
        ReactiveFormsModule,
        MatTableModule,
        MatButtonToggleModule,
        MatInputModule,
        MatSelectModule,
      ],
      providers: [
        {provide: UserService, useValue: {currentUser: user(5, 'Tess')}},
        {provide: GroupService, useValue: groupService},
        {provide: AlertService, useValue: {success: vi.fn(), error: vi.fn()}},
        {provide: ConfirmationModalService, useValue: confirmationModal},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });

    if (template !== undefined) {
      testBed.overrideComponent(GroupSelectorComponent, {set: {template}});
    }

    return testBed.compileComponents();
  }

  function create(
    unit: Unit,
    inputs: Partial<GroupSelectorComponent> = {},
  ): ComponentFixture<GroupSelectorComponent> {
    const fixture = TestBed.createComponent(GroupSelectorComponent);
    Object.assign(fixture.componentInstance, {unit, onSelect: vi.fn(), ...inputs});
    fixture.detectChanges();
    return fixture;
  }

  describe('logic', () => {
    beforeEach(async () => {
      await configure('');
    });

    it('lists the group set the parent chose, not always the first one', () => {
      const {unit, setA, setB} = makeUnit();
      addGroup(setA, 1, 'From set A');
      addGroup(setB, 2, 'From set B');

      const component = create(unit, {selectedGroupSet: setB}).componentInstance;

      expect(component.selectedGroupSet).toBe(setB);
      expect(component.dataSource.data.map((group) => group.name)).toEqual(['From set B']);
    });

    it('falls back to the first set when the parent gives none', () => {
      const {unit, setA} = makeUnit();
      addGroup(setA, 1, 'From set A');

      const component = create(unit).componentInstance;

      expect(component.selectedGroupSet).toBe(setA);
      expect(component.dataSource.data.map((group) => group.name)).toEqual(['From set A']);
    });

    it('filters to my tutorials without throwing on a tutorial that has no tutor', () => {
      const {unit, setA, tutorial, untutored} = makeUnit();
      addGroup(setA, 1, 'Mine', tutorial);
      addGroup(setA, 2, 'Nobody runs this', untutored);
      addGroup(setA, 3, 'No tutorial at all');

      const unitRole = {user: user(5, 'Tess')} as UnitRole;
      const component = create(unit, {unitRole}).componentInstance;

      component.staffTutorialFilter = 'mine';
      expect(() => component.applyFilters()).not.toThrow();
      expect(component.dataSource.data.map((group) => group.name)).toEqual(['Mine']);
    });

    it('redraws the list when a group leaves the cache', () => {
      const {unit, setA} = makeUnit();
      const doomed = addGroup(setA, 1, 'Doomed');
      addGroup(setA, 2, 'Stays');

      const component = create(unit, {unitRole: {} as UnitRole}).componentInstance;
      expect(component.dataSource.data).toHaveLength(2);

      setA.groupsCache.delete(doomed);

      expect(component.dataSource.data.map((group) => group.name)).toEqual(['Stays']);
    });

    it('sorts group names the way people count', () => {
      const {unit, setA} = makeUnit();
      addGroup(setA, 1, 'Group 10');
      addGroup(setA, 2, 'Group 2');
      addGroup(setA, 3, 'Group 1');

      const component = create(unit).componentInstance;

      expect(component.dataSource.data.map((group) => group.name)).toEqual([
        'Group 1',
        'Group 2',
        'Group 10',
      ]);
    });

    it('asks before deleting, and closes the deleted group even after an edit was cancelled', () => {
      const {unit, setA} = makeUnit();
      const group = addGroup(setA, 1, 'Doomed');
      groupService.delete.mockReturnValue(of(undefined));

      const component = create(unit, {
        unitRole: {} as UnitRole,
        selectedGroup: group,
      }).componentInstance;
      const onSelect = component.onSelect as ReturnType<typeof vi.fn>;

      // Cancelling an edit leaves the edit marker as null, which used to make the
      // delete path think the null group was being edited and stop there.
      component.cancelEdit();
      component.deleteGroup(new Event('click'), group);

      expect(groupService.delete).not.toHaveBeenCalled();
      expect(confirmationModal.show).toHaveBeenCalledTimes(1);

      const confirm = confirmationModal.show.mock.calls[0][2] as () => void;
      confirm();

      expect(groupService.delete).toHaveBeenCalledWith(group, {cache: setA.groupsCache});
      expect(component.selectedGroup).toBeNull();
      expect(onSelect).toHaveBeenCalledWith(null);
    });

    it('keeps the row in edit mode and puts the old values back when a save fails', () => {
      const {unit, setA, tutorial} = makeUnit();
      const group = addGroup(setA, 1, 'Before', tutorial);
      groupService.update.mockReturnValue(throwError(() => 'Name taken'));

      const component = create(unit, {unitRole: {} as UnitRole}).componentInstance;

      component.startEditGroup(new Event('click'), group);
      component.formData.get('name').setValue('After');
      component.saveEdit(new Event('click'));

      expect(groupService.update).toHaveBeenCalledTimes(1);
      expect(group.name).toBe('Before');
      expect(component.editing(group)).toBe(true);
    });

    it('leaves edit mode without a request when nothing changed', () => {
      const {unit, setA, tutorial} = makeUnit();
      const group = addGroup(setA, 1, 'Same', tutorial);

      const component = create(unit, {unitRole: {} as UnitRole}).componentInstance;

      component.startEditGroup(new Event('click'), group);
      component.saveEdit(new Event('click'));

      expect(groupService.update).not.toHaveBeenCalled();
      expect(component.editing(group)).toBe(false);
    });

    it('lets a student with no tutorial create a group, and shows them in it', () => {
      const {unit, setA} = makeUnit();
      const student = new Project(unit);
      student.id = 42;

      const created = new Group(unit);
      created.id = 9;
      created.name = 'Group 1';
      created.groupSet = setA;
      const response: Subject<Group> = new Subject();
      groupService.create.mockReturnValue(response);

      const component = create(unit, {project: student}).componentInstance;
      const onSelect = component.onSelect as ReturnType<typeof vi.fn>;

      expect(() => component.addGroup('')).not.toThrow();
      const body = groupService.create.mock.calls[0][1].body;
      expect(body.group.tutorial_id).toBe(10);

      response.next(created);

      expect(student.inGroup(created)).toBe(true);
      expect(created.projects).toContain(student);
      expect(onSelect).toHaveBeenCalledWith(created);
    });

    it('does not open a new group once the page has moved to another set', () => {
      const {unit, setA, setB} = makeUnit();
      const created = new Group(unit);
      created.id = 9;
      created.name = 'Group 1';
      created.groupSet = setA;
      const response: Subject<Group> = new Subject();
      groupService.create.mockReturnValue(response);

      const component = create(unit, {
        unitRole: {user: user(5, 'Tess')} as UnitRole,
      }).componentInstance;
      const onSelect = component.onSelect as ReturnType<typeof vi.fn>;

      component.addGroup('Late');
      component.selectGroupSet(setB);
      response.next(created);

      expect(onSelect).not.toHaveBeenCalled();
      expect(component.selectedGroupSet).toBe(setB);
    });

    it('tells the parent when a different group set is picked', () => {
      const {unit, setA, setB} = makeUnit();
      addGroup(setA, 1, 'From set A');
      addGroup(setB, 2, 'From set B');

      const component = create(unit).componentInstance;
      const emitted: GroupSet[] = [];
      component.selectedGroupSetChange.subscribe((set) => emitted.push(set));

      component.selectGroupSet(setB);

      expect(emitted).toEqual([setB]);
      expect(component.dataSource.data.map((group) => group.name)).toEqual(['From set B']);
    });

    it('only offers the set picker when the parent allows it', () => {
      const {unit} = makeUnit();

      expect(create(unit).componentInstance.canChooseGroupSet).toBe(true);
      expect(create(unit, {showGroupSetSelector: false}).componentInstance.canChooseGroupSet).toBe(
        false,
      );
    });
  });

  describe('template', () => {
    beforeEach(async () => {
      await configure();
    });

    it('renders groups whose tutorial is missing instead of blanking the table', () => {
      const {unit, setA, tutorial} = makeUnit();
      addGroup(setA, 1, 'Has a tutorial', tutorial);
      addGroup(setA, 2, 'Lost its tutorial');

      const fixture = create(unit, {unitRole: {user: user(5, 'Tess')} as UnitRole});
      const rows = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('tr.mat-mdc-row'),
      ).map((row) => row.textContent.replace(/\s+/g, ' ').trim());

      expect(rows).toHaveLength(2);
      expect(rows[0]).toContain('Has a tutorial');
      expect(rows[0]).toContain('LA1');
      expect(rows[1]).toContain('Lost its tutorial');
      expect(rows[1]).toContain('None');
    });

    it('labels every icon-only action button', () => {
      const {unit, setA, tutorial} = makeUnit();
      addGroup(setA, 1, 'Alpha', tutorial);

      const fixture = create(unit, {unitRole: {user: user(5, 'Tess')} as UnitRole});
      const labels = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('td button[mat-icon-button]'),
      ).map((button) => button.getAttribute('aria-label'));

      expect(labels).toEqual(['Edit Alpha', 'Lock Alpha', 'Delete Alpha']);
    });
  });
});
