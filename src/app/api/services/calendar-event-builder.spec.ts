import {describe, expect, it} from 'vitest';
import {Project} from '../models/project';
import {Task} from '../models/task';
import {TaskDefinition} from '../models/task-definition';
import {Unit} from '../models/unit';
import {buildCalendarEvent} from './calendar-event-builder';

function buildTask(overrides: {
  unitCode?: string;
  abbreviation?: string;
  name?: string;
  taskDefId?: number;
  dueDate?: Date;
}): Task {
  const unit = new Unit();
  unit.code = overrides.unitCode ?? 'COS10001';
  unit.allowFlexibleDates = false;

  const definition = new TaskDefinition(unit);
  definition.id = overrides.taskDefId ?? 42;
  definition.abbreviation = overrides.abbreviation ?? '1.1P';
  definition.name = overrides.name ?? 'Hello World';
  definition.targetDate = undefined;

  const task = new Task(unit);
  task.definition = definition;
  task.dueDate = overrides.dueDate;

  return task;
}

describe('buildCalendarEvent', () => {
  it('builds the title, uid and date for a normal task', () => {
    const dueDate = new Date(2026, 8, 15);
    const task = buildTask({
      unitCode: 'COS10001',
      abbreviation: '1.1P',
      name: 'Hello World',
      taskDefId: 42,
      dueDate,
    });

    const event = buildCalendarEvent(task);

    expect(event).not.toBeNull();
    expect(event.title).toBe('COS10001: 1.1P: Hello World');
    expect(event.uid).toBe('E-42');
    expect(event.date).toBe('2026-09-15');
  });

  it('returns null when the task has no resolvable due date', () => {
    const task = buildTask({dueDate: undefined});

    const event = buildCalendarEvent(task);

    expect(event).toBeNull();
  });

  it('returns null when the resolved due date is invalid', () => {
    const task = buildTask({dueDate: new Date(Number.NaN)});

    const event = buildCalendarEvent(task);

    expect(event).toBeNull();
  });

  it('returns the title raw and unescaped, leaving escaping to the consumer', () => {
    const dueDate = new Date(2026, 8, 15);
    const task = buildTask({
      unitCode: 'COS10001',
      abbreviation: '1.1P',
      name: "Report, Part 1; Draft's Notes",
      dueDate,
    });

    const event = buildCalendarEvent(task);

    // Raw comma, semicolon and apostrophe survive untouched. Neither URL-encoding nor
    // ICS text-escaping (backslash before , ; and newlines) has been applied here. Both
    // are the consumer's responsibility at the point each is serialized.
    expect(event.title).toBe("COS10001: 1.1P: Report, Part 1; Draft's Notes");
  });

  it('returns null instead of throwing when a flexible-dates task has no project set', () => {
    const unit = new Unit();
    unit.code = 'COS10001';
    unit.allowFlexibleDates = true;

    const definition = new TaskDefinition(unit);
    definition.id = 42;
    definition.abbreviation = '1.1P';
    definition.name = 'Hello World';
    definition.targetDate = new Date(2026, 8, 20);

    const task = new Task(unit);
    task.definition = definition;
    // task.project is intentionally left unset. On a flexible-dates unit,
    // Task.localDueDate() dereferences this.project.targetGrade on this branch and
    // throws rather than returning a falsy value, this proves the guard is widened
    // to catch that and still return null, not propagate the exception.

    let event: ReturnType<typeof buildCalendarEvent>;
    expect(() => {
      event = buildCalendarEvent(task);
    }).not.toThrow();
    expect(event).toBeNull();
  });

  describe('localDueDate fallback chain', () => {
    it('uses the flexible-dates targetDueDate over task.dueDate', () => {
      const unit = new Unit();
      unit.code = 'COS10001';
      unit.allowFlexibleDates = true;

      const definition = new TaskDefinition(unit);
      definition.id = 42;
      definition.abbreviation = '1.1P';
      definition.name = 'Hello World';

      const task = new Task(unit);
      task.definition = definition;
      task.targetDueDate = new Date(2026, 8, 20);
      // task.dueDate is set to a different date. If localDueDate() were swapped for
      // task.dueDate this test would observe the wrong date and fail.
      task.dueDate = new Date(2026, 8, 1);

      const event = buildCalendarEvent(task);

      expect(event.date).toBe('2026-09-20');
    });

    it('uses the flexible-dates grade-specific target date over task.dueDate', () => {
      const unit = new Unit();
      unit.code = 'COS10001';
      unit.allowFlexibleDates = true;

      const definition = new TaskDefinition(unit);
      definition.id = 42;
      definition.abbreviation = '1.1P';
      definition.name = 'Hello World';
      definition.gradeDueDates = [{targetGrade: 1, targetDueDate: new Date(2026, 8, 22)}];

      const project = new Project(unit);
      project.targetGrade = 1;

      const task = new Task(unit);
      task.definition = definition;
      task.project = project;
      // task.targetDueDate is intentionally left unset, forcing the grade-specific
      // lookup branch. task.dueDate is set to a different date so this test would
      // fail if localDueDate() were swapped for task.dueDate.
      task.dueDate = new Date(2026, 8, 1);

      const event = buildCalendarEvent(task);

      expect(event.date).toBe('2026-09-22');
    });

    it('falls through to definition.targetDate when task.dueDate is unset', () => {
      const unit = new Unit();
      unit.code = 'COS10001';
      unit.allowFlexibleDates = false;

      const definition = new TaskDefinition(unit);
      definition.id = 42;
      definition.abbreviation = '1.1P';
      definition.name = 'Hello World';
      definition.targetDate = new Date(2026, 8, 25);

      const task = new Task(unit);
      task.definition = definition;
      // task.dueDate is intentionally left unset. definition.targetDate is the only
      // remaining source of a date, so this test would fail if localDueDate() were
      // swapped for task.dueDate.

      const event = buildCalendarEvent(task);

      expect(event.date).toBe('2026-09-25');
    });
  });
});
