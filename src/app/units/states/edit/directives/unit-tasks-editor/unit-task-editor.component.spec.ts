import {describe, expect, it, vi} from 'vitest';
import {BehaviorSubject, of} from 'rxjs';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {TaskDefinitionService} from 'src/app/api/services/task-definition.service';
import {UnitTaskEditorComponent} from './unit-task-editor.component';

// The component is constructed directly rather than through TestBed. The three
// handlers under test touch only the selected task definition, the filter and
// the confirmation modal, so a real component tree buys nothing here.
function editorWith(selected: unknown) {
  const confirmationModal = {show: vi.fn()};
  const taskDefinitionService = {mapping: {}};

  const component = new UnitTaskEditorComponent(
    taskDefinitionService as never,
    {query: () => ({subscribe: () => {}})} as never, // feedbackTemplateService
    {error: () => {}} as never, // alerts
    {} as never, // csvResultModalService
    {} as never, // csvUploadModal
    confirmationModal as never,
    {} as never, // unitService
  );

  component.selectedTaskDefinition = selected as never;
  return {component, confirmationModal};
}

// A saved task that has not been edited. hasChanges is what the component asks.
function savedTask(abbreviation: string) {
  return {
    id: 1,
    abbreviation,
    isNew: false,
    hasOriginalSaveData: true,
    hasChanges: () => false,
    setOriginalSaveData: () => {},
  };
}

// A task built by Add Task and never saved. isNew is true and hasChanges is
// false, because nothing ever recorded original save data for it.
function unsavedTask() {
  return {
    id: undefined as number | undefined,
    abbreviation: '1.1P',
    isNew: true,
    hasOriginalSaveData: false,
    hasChanges: () => false,
    setOriginalSaveData: () => {},
  };
}

describe('UnitTaskEditorComponent unsaved task guard', () => {
  it('keeps an unsaved task on screen while the list is filtered', () => {
    const {component} = editorWith(unsavedTask());
    const task = component.selectedTaskDefinition;

    component.taskDefinitionSource.filter = '';
    component.applyFilter('a');

    expect(component.taskDefinitionSource.filter).toBe('a');
    expect(component.selectedTaskDefinition).toBe(task);
  });

  it('asks before another task replaces an unsaved one', () => {
    const {component, confirmationModal} = editorWith(unsavedTask());
    const task = component.selectedTaskDefinition;
    const other = savedTask('2.1C');

    component.selectTaskDefinition(other as never);

    expect(confirmationModal.show).toHaveBeenCalledTimes(1);
    expect(confirmationModal.show).toHaveBeenCalledWith(
      'Discard unsaved changes',
      'This task has unsaved changes. If you continue, they will be lost.',
      expect.any(Function),
    );
    expect(component.selectedTaskDefinition).toBe(task);

    // Running the callback is what the convenor choosing to discard looks like.
    const proceed = confirmationModal.show.mock.calls[0][2] as () => void;
    proceed();

    expect(component.selectedTaskDefinition).toBe(other);
  });

  it('asks before a second Add Task discards the first one', () => {
    const {component, confirmationModal} = editorWith(unsavedTask());

    component.createTaskDefinition();

    expect(confirmationModal.show).toHaveBeenCalledTimes(1);
  });

  // The guard must not get in the way of ordinary use.
  it('does not ask when nothing is selected', () => {
    const {component, confirmationModal} = editorWith(null);
    const other = savedTask('2.1C');

    component.selectTaskDefinition(other as never);

    expect(confirmationModal.show).not.toHaveBeenCalled();
    expect(component.selectedTaskDefinition).toBe(other);
  });

  it('does not ask when the selected task is saved and untouched', () => {
    const {component, confirmationModal} = editorWith(savedTask('1.1P'));
    const other = savedTask('2.1C');

    component.selectTaskDefinition(other as never);

    expect(confirmationModal.show).not.toHaveBeenCalled();
    expect(component.selectedTaskDefinition).toBe(other);
  });
});

// A task with real fields, so a discard has something to put back.
function editableTask(): TaskDefinition {
  const task = new TaskDefinition({} as never);
  task.id = 7;
  task.abbreviation = '1.1P';
  task.name = 'Hello world';
  task.targetGrade = 0;
  task.startDate = new Date(2026, 2, 2);
  task.targetDate = new Date(2026, 2, 16);
  task.uploadRequirements = [{key: 'file0', name: 'Code', type: 'code'}];
  return task;
}

function editorForRealTask(unitService: object = {}) {
  const confirmationModal = {show: vi.fn()};
  const alerts = {success: vi.fn(), error: vi.fn()};
  const mapping = new TaskDefinitionService({} as never, {} as never, {} as never, {} as never)
    .mapping;

  const component = new UnitTaskEditorComponent(
    {mapping} as never,
    {query: () => ({subscribe: () => {}})} as never,
    alerts as never,
    {} as never,
    {} as never,
    confirmationModal as never,
    unitService as never,
  );
  component.unit = {deleteTaskDefinition: vi.fn()} as never;
  return {component, confirmationModal, alerts};
}

describe('UnitTaskEditorComponent discard', () => {
  it('puts the saved values back when the convenor discards their edits', () => {
    const task = editableTask();
    const {component, confirmationModal} = editorForRealTask();
    component.selectTaskDefinition(task);

    task.name = 'Changed name';
    task.targetDate.setDate(20);
    task.uploadRequirements[0].name = 'Report';
    expect(component.taskDefinitionHasChanges(task)).toBe(true);

    component.discardTaskDefinitionChanges();
    const proceed = confirmationModal.show.mock.calls[0][2] as () => void;
    proceed();

    expect(task.name).toBe('Hello world');
    expect(task.targetDate.getDate()).toBe(16);
    expect(task.uploadRequirements[0].name).toBe('Code');
    expect(component.taskDefinitionHasChanges(task)).toBe(false);
    expect(component.selectedTaskDefinition).toBe(task);
  });

  it('undoes the edits to a task that is left for another one', () => {
    const task = editableTask();
    const other = editableTask();
    other.id = 8;
    const {component, confirmationModal} = editorForRealTask();
    component.selectTaskDefinition(task);

    task.name = 'Changed name';
    component.selectTaskDefinition(other);
    (confirmationModal.show.mock.calls[0][2] as () => void)();

    expect(component.selectedTaskDefinition).toBe(other);
    expect(task.name).toBe('Hello world');
  });
});

describe('UnitTaskEditorComponent discard after leaving the tab', () => {
  it('goes back to the saved values, not to edits left from the last visit', () => {
    const task = editableTask();
    const first = editorForRealTask();
    first.component.selectTaskDefinition(task);
    task.name = 'Changed name';
    first.component.ngOnDestroy();

    // The tab is built again when the convenor comes back to it.
    const second = editorForRealTask();
    second.component.selectTaskDefinition(task);
    second.component.discardTaskDefinitionChanges();
    (second.confirmationModal.show.mock.calls[0][2] as () => void)();

    expect(task.name).toBe('Hello world');
    expect(second.component.taskDefinitionHasChanges(task)).toBe(false);
  });
});

describe('UnitTaskEditorComponent after an import', () => {
  it('treats what the reload brought in as saved, so Discard does not undo the import', () => {
    const task = editableTask();
    const unitService = {
      fetch: vi.fn(() => {
        // The reload writes the server's copy over the task in place.
        task.name = 'Imported name';
        return of({});
      }),
    };
    const csvUploadModal = {show: vi.fn()};
    const {component, confirmationModal} = editorForRealTask(unitService);
    (component as unknown as {csvUploadModal: object}).csvUploadModal = csvUploadModal;
    (component as unknown as {csvResultModalService: object}).csvResultModalService = {
      show: vi.fn(),
    };
    component.unit = {
      id: 5,
      taskDefinitions: [task],
      getTaskDefinitionBatchUploadUrl: () => 'upload',
    } as never;
    component.selectTaskDefinition(task);

    component.uploadTaskDefinitionsCsv();
    const onSuccess = csvUploadModal.show.mock.calls[0][4] as (response: object) => void;
    onSuccess({success: [{}]});

    expect(component.taskDefinitionHasChanges(task)).toBe(false);
    task.name = 'Edited after the import';
    component.discardTaskDefinitionChanges();
    (confirmationModal.show.mock.calls[0][2] as () => void)();
    expect(task.name).toBe('Imported name');
  });

  it('asks before an import writes over unsaved edits to the open task', () => {
    const task = editableTask();
    const csvUploadModal = {show: vi.fn()};
    const {component, confirmationModal} = editorForRealTask();
    (component as unknown as {csvUploadModal: object}).csvUploadModal = csvUploadModal;
    component.selectTaskDefinition(task);
    task.name = 'Unsaved';

    component.uploadTaskResourcesZip();

    expect(confirmationModal.show).toHaveBeenCalled();
    expect(csvUploadModal.show).not.toHaveBeenCalled();
  });
});

describe('UnitTaskEditorComponent delete', () => {
  it('drops a task that was never saved without asking the server to delete it', () => {
    const {component, confirmationModal} = editorWith(unsavedTask());
    const unit = {deleteTaskDefinition: vi.fn()};
    component.unit = unit as never;

    component.deleteTaskDefinition(component.selectedTaskDefinition);
    (confirmationModal.show.mock.calls[0][2] as () => void)();

    expect(unit.deleteTaskDefinition).not.toHaveBeenCalled();
    expect(component.selectedTaskDefinition).toBeNull();
  });

  it('closes the editor when the open task is deleted from the unit', () => {
    const task = savedTask('1.1P');
    const other = savedTask('2.1C');
    const values: BehaviorSubject<unknown[]> = new BehaviorSubject([task, other]);
    const {component} = editorWith(null);
    component.unit = {taskDefinitionCache: {values}} as never;
    component.ngOnInit();
    component.selectTaskDefinition(task as never);

    values.next([other]);

    expect(component.selectedTaskDefinition).toBeNull();
    component.ngOnDestroy();
  });
});

describe('UnitTaskEditorComponent dates by grade', () => {
  const firstGrade = {value: 0, label: 'Pass'} as never;

  it('does not save when the first grade date is cleared while typing', () => {
    const {component} = editorWith(null);
    const task = {setGradeStartDate: vi.fn(), save: vi.fn()};

    component.setGradeStartDate(task as never, firstGrade, null);

    expect(task.setGradeStartDate).not.toHaveBeenCalled();
    expect(task.save).not.toHaveBeenCalled();
  });

  it('flags a cell whose start is after its target', () => {
    const {component} = editorWith(null);
    const task = editableTask();
    task.startDate = new Date(2026, 2, 20);

    const matcher = component.dateOrderMatcher(task, firstGrade);

    expect(matcher.isErrorState(null, null)).toBe(true);
    expect(component.dateOrderMatcher(task, firstGrade)).toBe(matcher);
  });
});
