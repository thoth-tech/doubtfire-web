import {afterEach, describe, expect, it, vi} from 'vitest';
import {Task} from '../models/task';
import {TaskDefinition} from '../models/task-definition';
import {Unit} from '../models/unit';
import {buildIcsCalendar} from './ics-calendar-builder';

function buildTask(overrides: {
  unitId?: number;
  unitCode?: string;
  abbreviation?: string;
  name?: string;
  taskDefId?: number;
  dueDate?: Date;
  targetDate?: Date;
}): Task {
  const unit = new Unit();
  unit.id = overrides.unitId ?? 7;
  unit.code = overrides.unitCode ?? 'COS10001';
  unit.allowFlexibleDates = false;

  const definition = new TaskDefinition(unit);
  definition.id = overrides.taskDefId ?? 42;
  definition.abbreviation = overrides.abbreviation ?? '1.1P';
  definition.name = overrides.name ?? 'Hello World';
  definition.targetDate = overrides.targetDate;

  const task = new Task(unit);
  task.definition = definition;
  task.dueDate = overrides.dueDate;

  return task;
}

// window.open leakage was the known cause the last time a spec here skipped this, see
// task-description-card.component.spec.ts. Nothing in this file mocks window.open, but this
// avoids the same class of leak for anything vi.spyOn touches in future tests added here.
afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildIcsCalendar', () => {
  it('escapes backslash, semicolon and comma in the title, and leaves an apostrophe untouched', () => {
    const dueDate = new Date(2026, 8, 15, 23, 59, 59, 999);
    const task = buildTask({name: "A, B; C\\D's", dueDate});

    const ics = buildIcsCalendar([task]);

    // Backslash escaped first (\ -> \\), then ; -> \; and , -> \,. Apostrophe is not an
    // RFC 5545 special character and must survive unescaped.
    expect(ics).toContain("SUMMARY:COS10001: 1.1P: A\\, B\\; C\\\\D's");
  });

  it('sets DTSTART to the due date and exclusive DTEND to the following date', () => {
    const dueDate = new Date(2026, 8, 15, 23, 59, 59, 999);
    const task = buildTask({dueDate});

    const ics = buildIcsCalendar([task]);

    expect(ics).toContain('DTSTART;VALUE=DATE:20260915');
    expect(ics).toContain('DTEND;VALUE=DATE:20260916');
  });

  it('advances an exclusive DTEND safely across year boundaries', () => {
    const dueDate = new Date(2026, 11, 31, 23, 59, 59, 999);
    const task = buildTask({dueDate});

    const ics = buildIcsCalendar([task]);

    expect(ics).toContain('DTSTART;VALUE=DATE:20261231');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101');
  });

  it('includes STATUS, X-DOUBTFIRE-UNIT, X-DOUBTFIRE-TASK and UID', () => {
    const dueDate = new Date(2026, 8, 15, 23, 59, 59, 999);
    const task = buildTask({unitId: 7, taskDefId: 42, dueDate});

    const ics = buildIcsCalendar([task]);

    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('X-DOUBTFIRE-UNIT:7');
    expect(ics).toContain('X-DOUBTFIRE-TASK:42');
    expect(ics).toContain('UID:E-42');
  });

  it('skips a task whose buildCalendarEvent returns null', () => {
    const withDate = buildTask({taskDefId: 1, dueDate: new Date(2026, 8, 15, 23, 59, 59, 999)});
    const withoutDate = buildTask({taskDefId: 2, dueDate: undefined, targetDate: undefined});

    const ics = buildIcsCalendar([withDate, withoutDate]);

    expect(ics).toContain('UID:E-1');
    expect(ics).not.toContain('UID:E-2');
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
  });

  it('uses CRLF line endings throughout, not bare LF', () => {
    const dueDate = new Date(2026, 8, 15, 23, 59, 59, 999);
    const task = buildTask({dueDate});

    const ics = buildIcsCalendar([task]);

    expect(ics).toContain('\r\n');
    const withoutCrlf = ics.replaceAll('\r\n', '');
    expect(withoutCrlf.includes('\n')).toBe(false);
  });

  it('escapes every form of line break in text without leaving a control character', () => {
    const task = buildTask({
      name: 'First\r\nSecond\rThird\nFourth',
      dueDate: new Date(2026, 8, 15, 23, 59, 59, 999),
    });

    const ics = buildIcsCalendar([task]);

    expect(ics).toContain('SUMMARY:COS10001: 1.1P: First\\nSecond\\nThird\\nFourth');
    expect(ics.replaceAll('\r\n', '')).not.toContain('\r');
  });

  it('folds long UTF-8 content lines at no more than 75 octets', () => {
    const task = buildTask({
      name: `Long task ${'é'.repeat(40)}`,
      dueDate: new Date(2026, 8, 15, 23, 59, 59, 999),
    });

    const ics = buildIcsCalendar([task]);
    const physicalSummaryLines = ics
      .split('\r\n')
      .filter((line) => line.startsWith('SUMMARY:') || line.startsWith(' '));

    expect(physicalSummaryLines.length).toBeGreaterThan(1);
    expect(physicalSummaryLines.every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
      true,
    );
    expect(physicalSummaryLines.slice(1).every((line) => line.startsWith(' '))).toBe(true);
  });

  it('falls through to definition.targetDate, proving the date comes from buildCalendarEvent, not a raw dueDate read', () => {
    // task.dueDate is intentionally left unset. If this builder read task.dueDate directly
    // instead of calling buildCalendarEvent(task), this task would be indistinguishable from
    // one with no date at all and would be skipped, instead of resolving through
    // localDueDate()'s fallback to definition.targetDate. This test would fail under that
    // swap: it asserts the event is present, with the fallback date.
    const task = buildTask({
      taskDefId: 9,
      dueDate: undefined,
      targetDate: new Date(2026, 8, 25, 23, 59, 59, 999),
    });

    const ics = buildIcsCalendar([task]);

    expect(ics).toContain('UID:E-9');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260925');
  });

  it('produces a valid VCALENDAR envelope', () => {
    const dueDate = new Date(2026, 8, 15, 23, 59, 59, 999);
    const task = buildTask({dueDate});

    const ics = buildIcsCalendar([task]);

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('CALSCALE:GREGORIAN');
    expect(ics).toContain('METHOD:PUBLISH');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('includes a DTSTAMP in YYYYMMDDTHHMMSSZ form using the provided time', () => {
    const dueDate = new Date(2026, 8, 15, 23, 59, 59, 999);
    const task = buildTask({dueDate});
    const now = new Date(Date.UTC(2026, 7, 1, 3, 4, 5));

    const ics = buildIcsCalendar([task], now);

    expect(ics).toContain('DTSTAMP:20260801T030405Z');
  });
});
