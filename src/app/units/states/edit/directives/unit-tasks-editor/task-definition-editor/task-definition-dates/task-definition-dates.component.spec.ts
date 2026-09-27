import {describe, expect, it} from 'vitest';
import {TaskDefinitionDatesComponent} from './task-definition-dates.component';

function datesFor(startDate: Date, targetDate: Date, dueDate: Date) {
  const component = new TaskDefinitionDatesComponent();
  component.taskDefinition = {startDate, targetDate, dueDate} as never;
  return component;
}

describe('TaskDefinitionDatesComponent', () => {
  it('marks a target date that falls before the start date', () => {
    const component = datesFor(new Date(2026, 2, 10), new Date(2026, 2, 5), new Date(2026, 3, 1));

    expect(component.targetDateMatcher.isErrorState(null, null)).toBe(true);
    expect(component.finalDateMatcher.isErrorState(null, null)).toBe(false);
  });

  it('marks a final feedback date before the target date', () => {
    const component = datesFor(new Date(2026, 2, 1), new Date(2026, 2, 20), new Date(2026, 2, 10));

    expect(component.finalDateMatcher.isErrorState(null, null)).toBe(true);
  });

  it('accepts dates on the same day, whatever the time of day', () => {
    const component = datesFor(
      new Date(2026, 2, 10, 0, 0),
      new Date(2026, 2, 10, 23, 59),
      new Date(2026, 2, 10, 12, 0),
    );

    expect(component.targetDateMatcher.isErrorState(null, null)).toBe(false);
    expect(component.finalDateMatcher.isErrorState(null, null)).toBe(false);
  });
});
