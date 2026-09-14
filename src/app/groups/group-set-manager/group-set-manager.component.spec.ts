import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Subject} from 'rxjs';
import {Group} from 'src/app/api/models/doubtfire-model';
import {GroupSetManagerComponent} from './group-set-manager.component';

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
