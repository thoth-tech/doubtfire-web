import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA, SimpleChange} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {Observable, Subject, of} from 'rxjs';
import {Group} from 'src/app/api/models/groups/group';
import {GroupSet} from 'src/app/api/models/groups/group-set';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';
import {UnitRole} from 'src/app/api/models/unit-role';
import {User} from 'src/app/api/models/user/user';
import {GroupService} from 'src/app/api/services/group.service';
import {ProjectService} from 'src/app/api/services/project.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GroupSetManagerComponent} from './group-set-manager.component';

function student(id: number, name: string, username: string): Project {
  const project = new Project();
  project.id = id;
  const user = new User();
  user.firstName = name;
  user.lastName = '';
  user.username = username;
  project.student = user;
  return project;
}

function makeGroup(set: GroupSet, id: number, name: string): Group {
  const group = new Group(set.unit);
  group.id = id;
  group.name = name;
  group.groupSet = set;
  set.groupsCache.add(group);
  return group;
}

describe('GroupSetManagerComponent', () => {
  let update: ReturnType<typeof vi.fn>;
  let loadStudents: ReturnType<typeof vi.fn<(unit: Unit) => Observable<Project[]>>>;
  let unit: Unit;
  let set: GroupSet;
  let ana: Project;
  let bo: Project;

  beforeEach(async () => {
    update = vi.fn();
    loadStudents = vi.fn<(unit: Unit) => Observable<Project[]>>(() => of([]));

    ana = student(1, 'Ana', 'aamos');
    bo = student(2, 'Bo', 'bbarnes');
    unit = {
      id: 1,
      studentsForGroupTypeAhead: (group: Group) =>
        [ana, bo].filter((project) => !group.projectsCache.has(project.id)),
    } as unknown as Unit;
    set = new GroupSet(unit);
    set.id = 100;

    await TestBed.configureTestingModule({
      declarations: [GroupSetManagerComponent],
      providers: [
        {provide: GroupService, useValue: {update}},
        {provide: ProjectService, useValue: {loadStudents}},
        {provide: AlertService, useValue: {success: vi.fn(), error: vi.fn()}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(GroupSetManagerComponent, {set: {template: ''}})
      .compileComponents();
  });

  function create(unitRole?: UnitRole): GroupSetManagerComponent {
    const component = TestBed.createComponent(GroupSetManagerComponent).componentInstance;
    component.unit = unit;
    component.selectedGroupSet = set;
    component.unitRole = unitRole;
    component.ngOnInit();
    return component;
  }

  it('keeps a saved rename when another group is opened', () => {
    const first = makeGroup(set, 1, 'Old name');
    const second = makeGroup(set, 2, 'Second');
    update.mockReturnValue(of(first));

    const component = create({} as UnitRole);
    component.newGroupSelected(first);
    component.startEditingGroupName();
    first.name = 'New name';
    component.updateGroup();

    component.newGroupSelected(second);

    expect(first.name).toBe('New name');
  });

  it('throws away a rename that was never saved', () => {
    const first = makeGroup(set, 1, 'Old name');
    const second = makeGroup(set, 2, 'Second');

    const component = create({} as UnitRole);
    component.newGroupSelected(first);
    component.startEditingGroupName();
    first.name = 'Half typed';

    component.newGroupSelected(second);

    expect(first.name).toBe('Old name');
    expect(component.editingGroupName).toBe(false);
  });

  it('puts the old name back on the renamed group when the save fails late', () => {
    const first = makeGroup(set, 1, 'Old name');
    const second = makeGroup(set, 2, 'Second');
    const response: Subject<Group> = new Subject();
    update.mockReturnValue(response);

    const component = create({} as UnitRole);
    component.newGroupSelected(first);
    component.startEditingGroupName();
    first.name = 'New name';
    component.updateGroup();

    component.newGroupSelected(second);
    response.error('Name taken');

    expect(first.name).toBe('Old name');
    expect(second.name).toBe('Second');
  });

  it('does not save a blank name', () => {
    const first = makeGroup(set, 1, 'Old name');

    const component = create({} as UnitRole);
    component.newGroupSelected(first);
    component.startEditingGroupName();
    first.name = '   ';
    component.updateGroup();

    expect(update).not.toHaveBeenCalled();
    expect(component.editingGroupName).toBe(true);
  });

  it('finds students to add by username as well as by name, leaving out members', () => {
    const group = makeGroup(set, 1, 'Team');
    group.projectsCache.add(ana);

    const component = create({} as UnitRole);
    component.newGroupSelected(group);

    component.control.setValue('bbar');
    expect(component.memberCandidates).toEqual([bo]);

    component.control.setValue('ana');
    expect(component.memberCandidates).toEqual([]);
  });

  it('closes the open group when another group set is picked', () => {
    const group = makeGroup(set, 1, 'Team');

    const component = create({} as UnitRole);
    component.newGroupSelected(group);
    component.onGroupSetChange();

    expect(component.selectedGroup).toBeNull();
  });

  it('opens the student group for the newly selected group set', () => {
    const first = makeGroup(set, 1, 'First set group');
    const secondSet = new GroupSet(unit);
    secondSet.id = 200;
    const second = makeGroup(secondSet, 2, 'Second set group');
    ana.groupCache.add(first);
    ana.groupCache.add(second);
    const component = create();
    component.project = ana;
    component.ngOnChanges({project: new SimpleChange(undefined, ana, true)});
    expect(component.selectedGroup).toBe(first);

    component.onGroupSetChange(secondSet);

    expect(component.selectedGroupSet).toBe(secondSet);
    expect(component.selectedGroup).toBe(second);
  });

  it('closes the open group when the page moves to another unit', () => {
    const group = makeGroup(set, 1, 'Team');

    const component = create({} as UnitRole);
    component.newGroupSelected(group);

    const otherUnit = {id: 2} as Unit;
    component.unit = otherUnit;
    component.ngOnChanges({unit: new SimpleChange(unit, otherUnit, false)});

    expect(component.selectedGroup).toBeNull();
    expect(loadStudents).toHaveBeenLastCalledWith(otherUnit);
  });

  it('fetches the unit students for staff, so the add list is complete', () => {
    create({} as UnitRole);
    expect(loadStudents).toHaveBeenCalledWith(unit);
  });

  it('does not ask for the student list on a student page', () => {
    create(undefined);
    expect(loadStudents).not.toHaveBeenCalled();
  });

  it('hands the selector the same select handler every time', () => {
    const component = create({} as UnitRole);
    expect(component.groupSelectHandler).toBe(component.groupSelectHandler);
  });
});

describe('GroupSetManagerComponent group-name updates', () => {
  let component: GroupSetManagerComponent;
  let updateResult: Subject<Group>;
  let originalGroup: Group;
  let nextGroup: Group;

  beforeEach(() => {
    updateResult = new Subject<Group>();
    component = new GroupSetManagerComponent(
      {update: vi.fn(() => updateResult)} as never,
      {success: vi.fn(), error: vi.fn()} as never,
      {} as never,
    );
    component.unit = {id: 1, studentsForGroupTypeAhead: () => []} as never;
    originalGroup = {
      id: 10,
      name: 'Original name',
      groupSet: {id: 20},
      projects: [],
    } as never;
    nextGroup = {
      id: 11,
      name: 'Next group',
      groupSet: {id: 20},
      projects: [],
    } as never;
    component.selectedGroup = originalGroup;
    component.startEditingGroupName();
    originalGroup.name = 'Saved name';
  });

  it('keeps the submitted name when another group is selected before the request resolves', () => {
    component.updateGroup();

    component.newGroupSelected(nextGroup);
    updateResult.next(originalGroup);

    expect(originalGroup.name).toBe('Saved name');
  });

  it('restores the previous name if the pending update fails after selection changes', () => {
    component.updateGroup();
    component.newGroupSelected(nextGroup);

    updateResult.error('update failed');

    expect(originalGroup.name).toBe('Original name');
  });
});
