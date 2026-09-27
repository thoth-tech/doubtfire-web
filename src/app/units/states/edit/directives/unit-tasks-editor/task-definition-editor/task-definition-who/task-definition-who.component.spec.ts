import {describe, expect, it} from 'vitest';
import {INDIVIDUAL_SUBMISSION, TaskDefinitionWhoComponent} from './task-definition-who.component';

describe('TaskDefinitionWhoComponent', () => {
  it('stores individual work as no group set, not as the text "null"', () => {
    const component = new TaskDefinitionWhoComponent();
    component.taskDefinition = {groupSet: {name: 'Teams'}} as never;

    component.groupSetChoice = INDIVIDUAL_SUBMISSION;

    expect(component.taskDefinition.groupSet).toBeNull();
  });

  it('shows individual work as picked when the task has no group set', () => {
    const component = new TaskDefinitionWhoComponent();
    component.taskDefinition = {groupSet: null} as never;

    expect(component.groupSetChoice).toBe(INDIVIDUAL_SUBMISSION);
  });

  it('shows no classes rather than failing when the task has no stream', () => {
    const component = new TaskDefinitionWhoComponent();
    component.taskDefinition = {tutorialStream: null, unit: {}} as never;

    expect(component.relatedTutorials).toEqual([]);
  });
});
