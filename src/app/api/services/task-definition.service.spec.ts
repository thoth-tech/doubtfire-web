import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {Unit} from '../models/unit';
import {TaskDefinitionService} from './task-definition.service';

describe('TaskDefinitionService grade due-date mapping', () => {
  let originalTimezone: string | undefined;

  beforeEach(() => {
    originalTimezone = process.env.TZ;
    process.env.TZ = 'America/New_York';
  });

  afterEach(() => {
    if (originalTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimezone;
    }
  });

  it('preserves nested grade dates serialized as UTC-midnight timestamps', () => {
    const service = new TaskDefinitionService(null, null, null, null);
    const taskDefinition = service.buildInstance(
      {
        grade_due_dates: [
          {
            target_grade: 1,
            target_due_date: '2026-09-15T00:00:00.000Z',
            start_date: '2026-09-08T00:00:00.000Z',
          },
        ],
      },
      {constructorParams: new Unit()},
    );

    const [gradeDate] = taskDefinition.gradeDueDates;
    expect([
      gradeDate.targetDueDate.getFullYear(),
      gradeDate.targetDueDate.getMonth(),
      gradeDate.targetDueDate.getDate(),
      gradeDate.targetDueDate.getHours(),
    ]).toEqual([2026, 8, 15, 0]);
    expect([
      gradeDate.startDate.getFullYear(),
      gradeDate.startDate.getMonth(),
      gradeDate.startDate.getDate(),
      gradeDate.startDate.getHours(),
    ]).toEqual([2026, 8, 8, 0]);
  });
});
