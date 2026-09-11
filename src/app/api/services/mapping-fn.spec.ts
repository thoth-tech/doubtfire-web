import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {MappingFunctions} from './mapping-fn';

describe('MappingFunctions date-only mapping', () => {
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

  it('preserves an API date-only value when mapping to the end of the local day', () => {
    const result = MappingFunctions.mapDateToEndOfDay({dueDate: '2026-09-15'}, 'dueDate', null);

    expect([
      result.getFullYear(),
      result.getMonth(),
      result.getDate(),
      result.getHours(),
      result.getMinutes(),
      result.getSeconds(),
      result.getMilliseconds(),
    ]).toEqual([2026, 8, 15, 23, 59, 59, 999]);
  });

  it('preserves an API date-only value when mapping to the start of the local day', () => {
    const result = MappingFunctions.mapDateToDay(
      {targetDueDate: '2026-09-15'},
      'targetDueDate',
      null,
    );

    expect([
      result.getFullYear(),
      result.getMonth(),
      result.getDate(),
      result.getHours(),
      result.getMinutes(),
      result.getSeconds(),
      result.getMilliseconds(),
    ]).toEqual([2026, 8, 15, 0, 0, 0, 0]);
  });

  it('keeps ordinary timestamp mapping instant-based', () => {
    const result = MappingFunctions.mapDateToDay(
      {completedAt: '2026-09-15T00:00:00.000Z'},
      'completedAt',
      null,
    );

    expect([
      result.getFullYear(),
      result.getMonth(),
      result.getDate(),
      result.getHours(),
      result.getMinutes(),
      result.getSeconds(),
      result.getMilliseconds(),
    ]).toEqual([2026, 8, 14, 0, 0, 0, 0]);
  });
});
