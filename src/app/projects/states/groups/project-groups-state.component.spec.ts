import {describe, expect, it} from 'vitest';
import {ActivatedRoute} from '@angular/router';
import {of} from 'rxjs';
import {GroupSet, Project} from 'src/app/api/models/doubtfire-model';
import {ProjectGroupsStateComponent} from './project-groups-state.component';

describe('ProjectGroupsStateComponent group-set selection', () => {
  const route = {parent: {snapshot: {data: {}}}} as unknown as ActivatedRoute;

  it("selects the student's real group set before an empty first set", () => {
    const empty = {id: 1, groups: []} as unknown as GroupSet;
    const enrolled = {id: 2, groups: [{id: 20}]} as unknown as GroupSet;
    const project = {
      unit: {groupSets: [empty, enrolled]},
      groups: [{groupSet: enrolled}],
    } as unknown as Project;
    const component = new ProjectGroupsStateComponent(route);
    component.project$ = of(project);

    component.ngOnInit();

    expect(component.selectedGroupSet).toBe(enrolled);
  });

  it('falls back to the first non-empty configured set when the student has no group', () => {
    const empty = {id: 1, groups: []} as unknown as GroupSet;
    const published = {id: 2, groups: [{id: 20}]} as unknown as GroupSet;
    const project = {
      unit: {groupSets: [empty, published]},
      groups: [],
    } as unknown as Project;
    const component = new ProjectGroupsStateComponent(route);
    component.project$ = of(project);

    component.ngOnInit();

    expect(component.selectedGroupSet).toBe(published);
  });

  it('selects an empty set that students can create groups in when no set has groups', () => {
    const staffOnly = {id: 1, groups: [], allowStudentsToCreateGroups: false, locked: false};
    const lockedOpen = {id: 2, groups: [], allowStudentsToCreateGroups: true, locked: true};
    const open = {id: 3, groups: [], allowStudentsToCreateGroups: true, locked: false};
    const project = {
      unit: {groupSets: [staffOnly, lockedOpen, open]},
      groups: [],
    } as unknown as Project;
    const component = new ProjectGroupsStateComponent(route);
    component.project$ = of(project);

    component.ngOnInit();

    expect(component.selectedGroupSet).toBe(open);
  });

  it('still prefers a set with groups over an empty set that allows student-created groups', () => {
    const open = {id: 1, groups: [], allowStudentsToCreateGroups: true, locked: false};
    const published = {id: 2, groups: [{id: 20}], allowStudentsToCreateGroups: false};
    const project = {
      unit: {groupSets: [open, published]},
      groups: [],
    } as unknown as Project;
    const component = new ProjectGroupsStateComponent(route);
    component.project$ = of(project);

    component.ngOnInit();

    expect(component.selectedGroupSet).toBe(published);
  });
});
