import {describe, expect, it, vi} from 'vitest';
import {CommunicationSetSchedule} from 'src/app/api/models/doubtfire-model';
import {CommunicationScheduleModalComponent} from './communication-schedule-modal.component';

function modalFor(schedule: Partial<CommunicationSetSchedule>) {
  const dialogRef = {close: vi.fn()};
  const component = new CommunicationScheduleModalComponent({} as never, dialogRef as never, {
    schedule: new CommunicationSetSchedule(schedule),
  });
  return {component, dialogRef};
}

describe('CommunicationScheduleModalComponent', () => {
  it('drops the repeat count and end date from a schedule that runs once', () => {
    const {component, dialogRef} = modalFor({
      name: 'Reminder',
      recurrence: 'weekly',
      repeat_count: 3,
      until_at: '2026-10-01T09:00',
    });

    component.draft.recurrence = 'none';
    component.save();

    const saved: CommunicationSetSchedule = dialogRef.close.mock.calls[0][0];
    expect(saved.repeat_count).toBeUndefined();
    expect(saved.until_at).toBeUndefined();
    expect(component.scheduleSummary()).not.toContain('times');
  });

  it('keeps them for a schedule that repeats', () => {
    const {component, dialogRef} = modalFor({recurrence: 'weekly', repeat_count: 3});

    component.save();

    expect(dialogRef.close.mock.calls[0][0].repeat_count).toBe(3);
    expect(component.intervalUnit).toBe('weeks');
  });
});
