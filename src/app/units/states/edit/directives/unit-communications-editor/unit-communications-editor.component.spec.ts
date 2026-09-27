import {describe, expect, it, vi} from 'vitest';
import {SimpleChange} from '@angular/core';
import {BehaviorSubject, of, throwError} from 'rxjs';
import {CommunicationRule, CommunicationSet} from 'src/app/api/models/doubtfire-model';
import {UnitCommunicationsEditorComponent} from './unit-communications-editor.component';

function set(id: number, ruleIds: number[]): CommunicationSet {
  return new CommunicationSet({
    id,
    name: `Set ${id}`,
    rules: ruleIds.map((ruleId) => ({id: ruleId, name: `Rule ${ruleId}`})) as CommunicationRule[],
  });
}

function communicationsEditor() {
  const ruleService = {deleteForUnit: vi.fn(() => of(undefined))};
  const setService = {
    getForUnit: vi.fn(() => of([])),
    getForUnitById: vi.fn(() => of({id: 1, rules: [], previews: []})),
    deleteForUnit: vi.fn(() => of(undefined)),
  };
  const projectService = {loadStudents: vi.fn(() => of([]))};
  const campusService = {query: vi.fn(() => of([]))};
  const confirmationModal = {show: vi.fn()};
  const component = new UnitCommunicationsEditorComponent(
    ruleService as never,
    {} as never,
    {} as never,
    setService as never,
    projectService as never,
    {} as never,
    campusService as never,
    {error: vi.fn(), success: vi.fn()} as never,
    {} as never,
    confirmationModal as never,
  );
  component.unit = {
    id: 5,
    taskDefinitionCache: {currentValues: [], values: new BehaviorSubject([])},
    tutorials: [],
    tutorialStreams: [],
    students: [],
  } as never;
  return {component, ruleService, setService, projectService, confirmationModal};
}

function confirm(confirmationModal: {show: ReturnType<typeof vi.fn>}) {
  (confirmationModal.show.mock.calls.at(-1)[2] as () => void)();
}

describe('UnitCommunicationsEditorComponent', () => {
  it('loads the sets once when the page opens', () => {
    const {component, setService, projectService} = communicationsEditor();

    component.ngOnChanges({unit: new SimpleChange(undefined, component.unit, true)});
    component.ngOnInit();

    expect(setService.getForUnit).toHaveBeenCalledTimes(1);
    expect(projectService.loadStudents).toHaveBeenCalledTimes(1);
    component.ngOnDestroy();
  });

  it('says the sets failed to load, rather than that there are none, and can try again', () => {
    const {component, setService} = communicationsEditor();
    setService.getForUnit.mockReturnValueOnce(throwError(() => 'offline') as never);

    component.ngOnInit();
    expect(component.loadError).toBe(true);

    component.retryLoadSets();
    expect(component.loadError).toBe(false);
    expect(setService.getForUnit).toHaveBeenCalledTimes(2);
    component.ngOnDestroy();
  });

  it('takes a rule out of its own set when another set is open', () => {
    const {component, ruleService, confirmationModal} = communicationsEditor();
    const open = set(1, [10, 11]);
    const other = set(2, [20, 21]);
    component.sets = [open, other];
    component.selectedSetId = 1;
    component.rules = open.rules;

    component.deleteRule(other.rules[0]);
    expect(ruleService.deleteForUnit).not.toHaveBeenCalled();
    confirm(confirmationModal);

    expect(ruleService.deleteForUnit).toHaveBeenCalledWith(5, 20);
    expect(other.rules.map((rule) => rule.id)).toEqual([21]);
    expect(open.rules.map((rule) => rule.id)).toEqual([10, 11]);
    expect(component.rules.map((rule) => rule.id)).toEqual([10, 11]);
  });

  it('asks before deleting a set', () => {
    const {component, setService, confirmationModal} = communicationsEditor();
    component.sets = [set(1, [])];

    component.deleteSet(component.sets[0]);
    expect(setService.deleteForUnit).not.toHaveBeenCalled();

    confirm(confirmationModal);
    expect(setService.deleteForUnit).toHaveBeenCalledWith(5, 1);
    expect(component.sets).toEqual([]);
  });

  it('names statuses the way the rest of the app does', () => {
    const {component} = communicationsEditor();

    expect(component.taskStatusLabel('fix_and_resubmit')).toBe('Resubmit');
    expect(component.taskStatusLabel('ready_for_feedback')).toBe('Awaiting Feedback');
  });
});
