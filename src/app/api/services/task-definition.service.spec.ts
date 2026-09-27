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

  it('does not clear an existing group set while its cache entry is still loading', () => {
    const service = new TaskDefinitionService(null, null, null, null);
    const unit = new Unit();
    const taskDefinition = service.buildInstance({group_set_id: 17}, {constructorParams: unit});

    expect(taskDefinition.groupSet).toBeUndefined();
    const payload = taskDefinition.toJson(service.mapping) as {task_def: {group_set_id?: number}};
    expect(payload.task_def.group_set_id).toBeUndefined();
  });

  it('clears a group set only when individual work was explicitly selected', () => {
    const service = new TaskDefinitionService(null, null, null, null);
    const taskDefinition = service.buildInstance({}, {constructorParams: new Unit()});
    taskDefinition.groupSet = null;

    const payload = taskDefinition.toJson(service.mapping) as {task_def: {group_set_id?: number}};
    expect(payload.task_def.group_set_id).toBe(-1);
  });

  it('maps the authoritative task-sheet filename and keeps a safe legacy fallback', () => {
    const service = new TaskDefinitionService(null, null, null, null);
    const unit = new Unit();
    unit.code = 'COS10001';
    const taskDefinition = service.buildInstance(
      {
        abbreviation: '1.1P',
        task_sheet_filename: 'COS10001-1.1P-TaskSheet.pdf',
      },
      {constructorParams: unit},
    );

    expect(taskDefinition.taskSheetFilename).toBe('COS10001-1.1P-TaskSheet.pdf');
    expect(taskDefinition.effectiveTaskSheetFilename).toBe('COS10001-1.1P-TaskSheet.pdf');

    taskDefinition.taskSheetFilename = undefined;
    expect(taskDefinition.effectiveTaskSheetFilename).toBe('COS10001-1.1P-TaskSheet.pdf');
  });
});

describe('Task definition resubmission setting', () => {
  it('keeps the default for older responses and maps a task-level opt out', () => {
    const service = new TaskDefinitionService(null, null, null, null);
    const unit = new Unit();
    expect(service.buildInstance({}, {constructorParams: unit}).resubmissionExtensionsEnabled).toBe(
      true,
    );
    const definition = service.buildInstance(
      {resubmission_extensions_enabled: false},
      {constructorParams: unit},
    );
    expect(definition.resubmissionExtensionsEnabled).toBe(false);
    definition.resubmissionExtensionsEnabled = true;
    expect(definition.toJson(service.mapping)['task_def']['resubmission_extensions_enabled']).toBe(
      true,
    );
  });
});
