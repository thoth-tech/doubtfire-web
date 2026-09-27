import {describe, expect, it} from 'vitest';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {restoreTaskDefinition, snapshotTaskDefinition} from './task-definition-snapshot';

// Stands in for a linked record such as a tutorial stream: an instance of a class,
// not a plain object.
class LinkedRecord {
  constructor(public abbreviation: string) {}
}

function task(): TaskDefinition {
  const definition = new TaskDefinition({} as never);
  definition.name = 'Hello world';
  definition.targetDate = new Date(2026, 2, 16);
  definition.uploadRequirements = [{key: 'file0', name: 'Code', type: 'code'}];
  definition.gradeDueDates = [{targetGrade: 1, startDate: new Date(2026, 2, 9)}];
  definition.tutorialStream = new LinkedRecord('lab') as never;
  definition.hasTaskSheet = false;
  return definition;
}

describe('task definition snapshot', () => {
  it('keeps its own copy of dates and lists that the editor changes in place', () => {
    const definition = task();
    const snapshot = snapshotTaskDefinition(definition);

    definition.targetDate.setDate(30);
    definition.uploadRequirements[0].name = 'Report';
    definition.uploadRequirements.push({key: 'file1', name: 'Extra', type: 'zip'});
    definition.gradeDueDates[0].startDate.setDate(1);
    restoreTaskDefinition(definition, snapshot);

    expect(definition.targetDate.getDate()).toBe(16);
    expect(definition.uploadRequirements).toEqual([{key: 'file0', name: 'Code', type: 'code'}]);
    expect(definition.gradeDueDates[0].startDate.getDate()).toBe(9);
  });

  it('keeps linked records as the same object, which the selects compare against', () => {
    const definition = task();
    const stream = definition.tutorialStream;
    const snapshot = snapshotTaskDefinition(definition);

    definition.tutorialStream = new LinkedRecord('other') as never;
    restoreTaskDefinition(definition, snapshot);

    expect(definition.tutorialStream).toBe(stream);
  });

  it('leaves alone what saves the moment it changes, such as an uploaded task sheet', () => {
    const definition = task();
    const snapshot = snapshotTaskDefinition(definition);

    definition.hasTaskSheet = true;
    restoreTaskDefinition(definition, snapshot);

    expect(definition.hasTaskSheet).toBe(true);
  });
});
