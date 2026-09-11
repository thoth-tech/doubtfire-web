import {describe, expect, it, vi} from 'vitest';
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
