import {afterEach, describe, expect, it, vi} from 'vitest';
import {firstValueFrom} from 'rxjs';
import {Project} from '../../models/project';
import {PeerProgressService} from '../peer-progress.service';

describe('PeerProgressService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a safe demo state without exposing raw cohort size', async () => {
    const project = {
      id: 42,
      targetGrade: 2,
      unit: {
        startDate: new Date(2026, 6, 1),
        endDate: new Date(2026, 7, 31),
      },
    } as unknown as Project;

    const service = new PeerProgressService();

    const response = await firstValueFrom(service.getCohortMedian(project, 3));

    expect(response).toMatchObject({
      project_id: 42,
      target_grade: 3,
      state: 'ready',
    });

    expect(Object.keys(response)).not.toContain('cohort_size');

    expect(response.median_burndown.length).toBeGreaterThan(0);

    expect(
      response.median_burndown.every((point) => point.remaining >= 0 && point.remaining <= 1),
    ).toBe(true);
  });

  it('shows the demo curve only through today without remapping its future values', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T00:00:00.000Z'));

    const project = {
      id: 42,
      targetGrade: 0,
      unit: {
        startDate: new Date('2026-07-12T00:00:00.000Z'),
        endDate: new Date('2026-10-11T00:00:00.000Z'),
      },
    } as unknown as Project;

    const response = await firstValueFrom(new PeerProgressService().getCohortMedian(project));
    const lastPoint = response.median_burndown.at(-1);

    expect(lastPoint).toEqual({
      date: '2026-08-23T00:00:00.000Z',
      remaining: 0.58,
    });
    expect(response.median_burndown.every((point) => new Date(point.date) <= new Date())).toBe(
      true,
    );
    expect(Math.round((1 - lastPoint!.remaining) * 100)).toBe(42);
    expect(lastPoint?.remaining).not.toBe(0);
  });
});
