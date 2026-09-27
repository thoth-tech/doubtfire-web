import {beforeEach, describe, expect, it, vi} from 'vitest';
import {of} from 'rxjs';
import {Group, GroupSet, Project, Unit} from 'src/app/api/models/doubtfire-model';
import {GroupSelectorComponent} from './group-selector.component';

describe('GroupSelectorComponent student card contract', () => {
  let component: GroupSelectorComponent;
  let project: Project;
  let groupSet: GroupSet;
  let group: Group;

  beforeEach(() => {
    component = new GroupSelectorComponent(
      {currentUser: {name: 'Demo Student'}} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    project = {inGroup: vi.fn(() => false)} as unknown as Project;
    groupSet = {
      groupsCache: {values: of([])},
      capacity: 4,
      locked: false,
      allowStudentsToManageGroups: true,
    } as unknown as GroupSet;
    group = {
      id: 40,
      name: 'Team Indigo',
      groupSet,
      memberCount: 3,
      capacityAdjustment: 0,
      locked: false,
      tutorial: {abbreviation: 'ST1'},
      hasSpace: () => true,
    } as unknown as Group;

    component.project = project;
    component.selectedGroupSet = groupSet;
  });

  it('derives tutorial and capacity copy from the authorised group entity', () => {
    expect(component.groupTutorialLabel(group)).toBe('ST1');
    expect(component.groupCapacityLabel(group)).toBe('3 of 4 places');
  });

  it('enables joining only when the real group-set policy, lock, and capacity permit it', () => {
    expect(component.canStudentJoin(group)).toBe(true);

    group.locked = true;
    expect(component.canStudentJoin(group)).toBe(false);
    group.locked = false;
    group.hasSpace = () => false;
    expect(component.canStudentJoin(group)).toBe(false);
  });

  it('preserves the group set selected by the project state', () => {
    const otherGroupSet = {id: 90} as GroupSet;
    component.unit = {groupSets: [otherGroupSet, groupSet]} as unknown as Unit;

    component.ngOnInit();

    expect(component.selectedGroupSet).toBe(groupSet);
  });
});
