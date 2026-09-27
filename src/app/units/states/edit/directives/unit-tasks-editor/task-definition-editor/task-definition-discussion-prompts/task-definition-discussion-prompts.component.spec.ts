import {describe, expect, it, vi} from 'vitest';
import {of} from 'rxjs';
import {TaskDefinitionDiscussionPromptsComponent} from './task-definition-discussion-prompts.component';

function promptsEditor() {
  const discussionPromptService = {put: vi.fn(() => of({})), create: vi.fn()};
  const alerts = {success: vi.fn(), error: vi.fn()};
  const confirmationModal = {show: vi.fn()};
  const component = new TaskDefinitionDiscussionPromptsComponent(
    alerts as never,
    discussionPromptService as never,
    confirmationModal as never,
  );
  component.taskDefinition = {id: 12} as never;
  const prompt = {id: 4, content: 'What did you test?', priority: 2};
  return {component, discussionPromptService, confirmationModal, prompt};
}

describe('TaskDefinitionDiscussionPromptsComponent', () => {
  it('saves a new priority for a prompt', () => {
    const {component, discussionPromptService, prompt} = promptsEditor();

    component.flagEdit(prompt as never);
    component.priorityControl.setValue(3);
    component.submit();

    expect(discussionPromptService.put).toHaveBeenCalledWith(
      expect.objectContaining({id: 4, task_definition_id: 12, priority: 3}),
    );
    expect(prompt.priority).toBe(3);
  });

  it('leaves the prompt as it was when an edit is cancelled', () => {
    const {component, prompt} = promptsEditor();

    component.flagEdit(prompt as never);
    component.contentControl.setValue('Something else');
    component.cancelEdit();

    expect(prompt.content).toBe('What did you test?');
  });

  it('does not add an empty prompt', () => {
    const {component, discussionPromptService} = promptsEditor();

    component.newDiscussionPromptContent = '   ';
    component.addNewPrompt();

    expect(component.canAddPrompt).toBe(false);
    expect(discussionPromptService.create).not.toHaveBeenCalled();
  });

  it('asks before deleting a prompt', () => {
    const {component, confirmationModal} = promptsEditor();
    const prompt = {delete: vi.fn()};

    component.deletePrompt(prompt as never);
    expect(prompt.delete).not.toHaveBeenCalled();

    (confirmationModal.show.mock.calls[0][2] as () => void)();
    expect(prompt.delete).toHaveBeenCalled();
  });
});
