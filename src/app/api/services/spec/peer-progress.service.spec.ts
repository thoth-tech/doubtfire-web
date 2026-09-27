import {afterEach, describe, expect, it, vi} from 'vitest';
import {firstValueFrom} from 'rxjs';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {
  DemoScenarioContract,
  DemoScenarioRegistryService,
} from 'src/app/demo/demo-scenario-registry.service';
import {Project} from '../../models/project';
import {PeerProgressService} from '../peer-progress.service';

describe('PeerProgressService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeService(
    projectId = 42,
    ppi: {
      state: 'available' | 'unavailable';
      unavailable_reason: string | null;
      submitted_percentage: number | null;
    } = {state: 'available', unavailable_reason: null, submitted_percentage: 60},
    enabled = true,
  ): PeerProgressService {
    const scenario = {
      units: [
        {
          key: 'DEMO10001',
          code: 'DEMO10001',
          name: 'Foundations',
          unit_id: 11,
          project_id: projectId,
          ppi: {
            ...ppi,
            task_abbreviation: 'DUE7',
            task_definition_id: 31,
            completed_percentage: ppi.state === 'available' ? 10 : null,
            status_distribution: null,
          },
        },
      ],
    } as DemoScenarioContract;

    return new PeerProgressService(
      {enabled} as DemoModeStore,
      {scenario} as DemoScenarioRegistryService,
    );
  }

  it('returns a safe demo state without exposing raw cohort size', async () => {
    const project = {
      id: 42,
      targetGrade: 2,
      unit: {
        startDate: new Date(2026, 6, 1),
        endDate: new Date(2026, 7, 31),
      },
    } as unknown as Project;

    const service = makeService(project.id);

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

  it('ends the demo curve at the deterministic current hook value without future points', async () => {
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

    const response = await firstValueFrom(makeService(project.id).getCohortMedian(project));
    const lastPoint = response.median_burndown.at(-1);

    expect(lastPoint).toEqual({
      date: '2026-08-23T00:00:00.000Z',
      remaining: 0.48,
    });
    expect(response.median_burndown.every((point) => new Date(point.date) <= new Date())).toBe(
      true,
    );
    expect(Math.round((1 - lastPoint!.remaining) * 100)).toBe(52);
    expect(lastPoint?.remaining).not.toBe(0);
  });

  it('keeps the deliberate unavailable unit below the privacy threshold', async () => {
    const project = {
      id: 52,
      targetGrade: 0,
      unit: {
        startDate: new Date('2026-07-12T00:00:00.000Z'),
        endDate: new Date('2026-10-11T00:00:00.000Z'),
      },
    } as unknown as Project;

    const response = await firstValueFrom(
      makeService(project.id, {
        state: 'unavailable',
        unavailable_reason: 'insufficient_cohort',
        submitted_percentage: null,
      }).getCohortMedian(project),
    );

    expect(response.state).toBe('suppressed');
    expect(response.median_burndown).toEqual([]);
    expect(Object.keys(response)).not.toContain('cohort_size');
  });

  it('returns no demo data when walkthrough presentation is off', async () => {
    const project = {
      id: 42,
      targetGrade: 0,
      unit: {startDate: new Date(), endDate: new Date()},
    } as unknown as Project;

    const response = await firstValueFrom(
      makeService(project.id, undefined, false).getCohortMedian(project),
    );

    expect(response.state).toBe('disabled');
    expect(response.median_burndown).toEqual([]);
  });
});
