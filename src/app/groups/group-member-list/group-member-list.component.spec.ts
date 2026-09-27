import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA, SimpleChange} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {Observable, Subject, of, throwError} from 'rxjs';
import {Group} from 'src/app/api/models/groups/group';
import {GroupSet} from 'src/app/api/models/groups/group-set';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';
import {User} from 'src/app/api/models/user/user';
import {GroupMemberListComponent} from './group-member-list.component';

function student(id: number, name: string): Project {
  const project = new Project();
  project.id = id;
  const user = new User();
  user.firstName = name;
  user.lastName = '';
  project.student = user;
  return project;
}

function makeGroup(id: number, members: Observable<Project[]>): Group {
  const unit = {id: 1} as Unit;
  const set = new GroupSet(unit);
  set.id = 100;
  const group = new Group(unit);
  group.id = id;
  group.groupSet = set;
  group.getMembers = () => members;
  return group;
}

describe('GroupMemberListComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GroupMemberListComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(GroupMemberListComponent, {set: {template: ''}})
      .compileComponents();
  });

  function open(component: GroupMemberListComponent, group: Group, previous?: Group) {
    component.selectedGroup = group;
    component.ngOnChanges({selectedGroup: new SimpleChange(previous, group, !previous)});
  }

  it('ignores a late reply for the group that was open before', () => {
    const component = TestBed.createComponent(GroupMemberListComponent).componentInstance;
    const firstReply: Subject<Project[]> = new Subject();
    const secondReply: Subject<Project[]> = new Subject();
    const first = makeGroup(1, firstReply);
    const second = makeGroup(2, secondReply);
    second.projectsCache.add(student(7, 'Cy'));

    open(component, first);
    open(component, second, first);

    // The first group's reply lands while the second group is still loading.
    firstReply.next([student(8, 'Di')]);
    expect(component.loading).toBe(true);
    expect(component.members).toEqual([]);

    secondReply.next([]);
    expect(component.loading).toBe(false);
    expect(component.members.map((member) => member.student.name)).toEqual(['Cy']);
  });

  it('follows members added to the open group, in name order', () => {
    const component = TestBed.createComponent(GroupMemberListComponent).componentInstance;
    const group = makeGroup(1, of([]));

    open(component, group);
    group.projectsCache.add(student(2, 'Zoe'));
    group.projectsCache.add(student(3, 'Amy'));

    expect(component.members.map((member) => member.student.name)).toEqual(['Amy', 'Zoe']);
  });

  it('shows a load failure and can try again', () => {
    const component = TestBed.createComponent(GroupMemberListComponent).componentInstance;
    const group = makeGroup(
      1,
      throwError(() => 'offline'),
    );

    open(component, group);
    expect(component.loadError).toBe(true);
    expect(component.loading).toBe(false);

    group.getMembers = vi.fn(() => of([]));
    component.loadMembers();

    expect(group.getMembers).toHaveBeenCalledTimes(1);
    expect(component.loadError).toBe(false);
  });

  it('stops a student removing members as soon as the group is locked', () => {
    const component = TestBed.createComponent(GroupMemberListComponent).componentInstance;
    const group = makeGroup(1, of([]));
    group.groupSet.allowStudentsToManageGroups = true;
    group.locked = false;

    open(component, group);
    expect(component.canRemoveMembers).toBe(true);

    group.locked = true;
    expect(component.canRemoveMembers).toBe(false);
  });

  it('lets staff remove members from a locked group', () => {
    const component = TestBed.createComponent(GroupMemberListComponent).componentInstance;
    const group = makeGroup(1, of([]));
    group.locked = true;
    component.unitRole = {} as never;

    open(component, group);

    expect(component.canRemoveMembers).toBe(true);
  });
});
