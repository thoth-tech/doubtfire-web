import {describe, expect, it} from 'vitest';
import {TaskStatus, TaskStatusEnum} from 'src/app/api/models/task-status';
import {buildStatusGuide} from './status-guide';

describe('buildStatusGuide', () => {
  const guide = buildStatusGuide();
  const rows = guide.flatMap((group) => group.rows);

  it('covers every status the app can show, once each', () => {
    const listed = rows.map((row) => row.status).sort();
    const expected = [...TaskStatus.STATUS_KEYS].sort();

    expect(listed).toEqual(expected);
    expect(new Set(listed).size).toBe(listed.length);
  });

  it('takes its wording from the same source the task pages read', () => {
    rows.forEach((row) => {
      const data = TaskStatus.statusData(row.status);
      expect(row.label).toBe(data.label);
      expect(row.reason).toBe(data.help.reason);
      expect(row.action).toBe(data.help.action);
    });
  });

  it('names a tone that matches a status token', () => {
    rows.forEach((row) => {
      expect(row.tone).toBe(TaskStatus.statusClass(row.status));
      expect(row.tone).not.toContain('_');
    });
  });

  it('drops a status that has no help text rather than showing an empty row', () => {
    const help = TaskStatus.HELP_DESCRIPTIONS;
    const removed = help.get('complete');
    help.delete('complete' as TaskStatusEnum);

    try {
      const withoutComplete = buildStatusGuide().flatMap((group) => group.rows);
      expect(withoutComplete.map((row) => row.status)).not.toContain('complete');
    } finally {
      help.set('complete' as TaskStatusEnum, removed);
    }
  });
});
