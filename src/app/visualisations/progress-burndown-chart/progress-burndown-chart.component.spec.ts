import {describe, expect, it, vi} from 'vitest';
import {SimpleChange, ViewContainerRef} from '@angular/core';
import {Subject, of, throwError} from 'rxjs';
import {
  PeerProgressResponse,
  PeerProgressService,
  PeerProgressState,
  Project,
} from 'src/app/api/models/doubtfire-model';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {ProgressBurndownChartComponent} from './progress-burndown-chart.component';

describe('ProgressBurndownChartComponent peer comparison', () => {
  const EXISTING_SERIES = ['Target', 'Projected', 'To Submit', 'To Complete'];

  function makeProject(): Project {
    const startDate = new Date(2026, 6, 1);
    const endDate = new Date(2026, 7, 31);

    return {
      id: 123,
      targetGrade: 2,
      unit: {
        startDate,
        endDate,
      },
      burndownChartData: [
        {
          key: 'Target',
          values: [
            [startDate.getTime(), 1],
            [endDate.getTime(), 0],
          ],
        },
        {
          key: 'Projected',
          values: [
            [startDate.getTime(), 0.9],
            [endDate.getTime(), 0.1],
          ],
        },
        {
          key: 'To Submit',
          values: [
            [startDate.getTime(), 0.8],
            [endDate.getTime(), 0.2],
          ],
        },
        {
          key: 'To Complete',
          values: [
            [startDate.getTime(), 0.7],
            [endDate.getTime(), 0.3],
          ],
        },
      ],
      refreshBurndownChartData: vi.fn(),
    } as unknown as Project;
  }

  function makeResponse(
    project: Project,
    state: PeerProgressState,
    targetGrade: number = project.targetGrade,
  ): PeerProgressResponse {
    return {
      project_id: project.id,
      target_grade: targetGrade,
      state,
      median_burndown:
        state === 'ready'
          ? [
              {
                date: project.unit.startDate.toISOString(),
                remaining: 0.75,
              },
              {
                date: project.unit.endDate.toISOString(),
                remaining: 0.25,
              },
            ]
          : [],
    };
  }

  function makeHarness(
    getCohortMedian: ReturnType<typeof vi.fn>,
    demoEnabled = true,
  ): {
    component: ProgressBurndownChartComponent;
    project: Project;
  } {
    const project = makeProject();

    const component = new ProgressBurndownChartComponent(
      {} as ViewContainerRef,
      {
        getCohortMedian,
      } as unknown as PeerProgressService,
      {enabled: demoEnabled} as DemoModeStore,
      'en-US',
    );

    component.project = project;
    component.unit = project.unit;
    component.grade = project.targetGrade;

    return {
      component,
      project,
    };
  }

  function initialise(component: ProgressBurndownChartComponent): void {
    // Angular calls ngOnChanges before ngOnInit for initial inputs.
    component.ngOnChanges({
      grade: new SimpleChange(undefined, component.grade, true),
    });

    component.ngOnInit();
  }

  function seriesNames(component: ProgressBurndownChartComponent): string[] {
    return component.data.map((series) => series.name);
  }

  it('does not request or render synthetic peer data when demo mode is off', () => {
    const getCohortMedian = vi.fn();
    const {component} = makeHarness(getCohortMedian, false);

    initialise(component);

    expect(getCohortMedian).not.toHaveBeenCalled();
    expect(seriesNames(component)).toEqual(EXISTING_SERIES);
    expect(component.peerMedianState).toBe('disabled');
  });

  function expectOnlyExistingSeries(component: ProgressBurndownChartComponent): void {
    expect(seriesNames(component)).toEqual(EXISTING_SERIES);
  }

  it('makes one initial request and keeps the real lines while loading', () => {
    const request: Subject<PeerProgressResponse> = new Subject();
    const getCohortMedian = vi.fn().mockReturnValue(request.asObservable());

    const {component, project} = makeHarness(getCohortMedian);

    initialise(component);

    expect(getCohortMedian).toHaveBeenCalledTimes(1);
    expect(getCohortMedian).toHaveBeenCalledWith(project, 2);
    expect(project.refreshBurndownChartData).toHaveBeenCalledTimes(1);
    expect(component.peerMedianState).toBe('loading');
    expectOnlyExistingSeries(component);

    component.ngOnDestroy();
  });

  it('appends the demo median without replacing existing lines', () => {
    const getCohortMedian = vi.fn();
    const {component, project} = makeHarness(getCohortMedian);

    getCohortMedian.mockReturnValue(of(makeResponse(project, 'ready')));

    initialise(component);

    expect(component.peerMedianState).toBe('ready');
    expect(seriesNames(component)).toEqual([...EXISTING_SERIES, 'Peer median (demo)']);

    const peerSeries = component.data.find((series) => series.name === 'Peer median (demo)');

    expect(peerSeries?.series.map((point) => point.value)).toEqual([75, 25]);
  });

  it('withholds the median when the response is suppressed', () => {
    const getCohortMedian = vi.fn();
    const {component, project} = makeHarness(getCohortMedian);

    getCohortMedian.mockReturnValue(of(makeResponse(project, 'suppressed')));

    initialise(component);

    expect(component.peerMedianState).toBe('suppressed');
    expectOnlyExistingSeries(component);
  });

  it('keeps the existing lines when peer data is unavailable', () => {
    const getCohortMedian = vi.fn();
    const {component, project} = makeHarness(getCohortMedian);

    getCohortMedian.mockReturnValue(of(makeResponse(project, 'unavailable')));

    initialise(component);

    expect(component.peerMedianState).toBe('unavailable');
    expectOnlyExistingSeries(component);
  });

  it('keeps the existing lines when peer comparison is disabled', () => {
    const getCohortMedian = vi.fn();
    const {component, project} = makeHarness(getCohortMedian);

    getCohortMedian.mockReturnValue(of(makeResponse(project, 'disabled')));

    initialise(component);

    expect(component.peerMedianState).toBe('disabled');
    expectOnlyExistingSeries(component);
  });

  it('shows an error state without removing the existing lines', () => {
    const getCohortMedian = vi.fn().mockReturnValue(throwError(() => new Error('network down')));

    const {component} = makeHarness(getCohortMedian);

    initialise(component);

    expect(component.peerMedianState).toBe('error');
    expectOnlyExistingSeries(component);
  });

  it('does not mutate the source burndown data while redrawing', () => {
    const getCohortMedian = vi.fn();
    const {component, project} = makeHarness(getCohortMedian);

    getCohortMedian.mockReturnValue(of(makeResponse(project, 'ready')));

    const sourceBefore = JSON.stringify(project.burndownChartData);

    initialise(component);
    component.updateData();

    expect(JSON.stringify(project.burndownChartData)).toBe(sourceBefore);
  });

  it('cancels the old grade request and only applies the current result', () => {
    const firstRequest: Subject<PeerProgressResponse> = new Subject();
    const secondRequest: Subject<PeerProgressResponse> = new Subject();

    const getCohortMedian = vi
      .fn()
      .mockReturnValueOnce(firstRequest.asObservable())
      .mockReturnValueOnce(secondRequest.asObservable());

    const {component, project} = makeHarness(getCohortMedian);

    initialise(component);

    project.targetGrade = 3;
    component.grade = 3;

    component.ngOnChanges({
      grade: new SimpleChange(2, 3, false),
    });

    expect(getCohortMedian).toHaveBeenCalledTimes(2);
    expect(getCohortMedian).toHaveBeenNthCalledWith(2, project, 3);
    expect(component.peerMedianState).toBe('loading');
    expectOnlyExistingSeries(component);

    // This must have no effect because its subscription was cancelled.
    firstRequest.next(makeResponse(project, 'ready', 2));

    expect(component.peerMedianState).toBe('loading');
    expectOnlyExistingSeries(component);

    secondRequest.next(makeResponse(project, 'ready', 3));

    expect(component.peerMedianState).toBe('ready');
    expect(seriesNames(component)).toEqual([...EXISTING_SERIES, 'Peer median (demo)']);

    component.ngOnDestroy();
  });

  it('refreshes both chart and peer data when a reused route receives a new project', () => {
    const getCohortMedian = vi.fn((currentProject: Project) =>
      of(makeResponse(currentProject, 'unavailable')),
    );
    const {component, project} = makeHarness(getCohortMedian);

    initialise(component);

    const nextProject = makeProject();
    nextProject.id = 456;
    component.project = nextProject;
    component.unit = nextProject.unit;

    component.ngOnChanges({
      project: new SimpleChange(project, nextProject, false),
      unit: new SimpleChange(project.unit, nextProject.unit, false),
    });

    expect(nextProject.refreshBurndownChartData).toHaveBeenCalledTimes(1);
    expect(getCohortMedian).toHaveBeenLastCalledWith(nextProject, nextProject.targetGrade);
  });

  it('toggles one accessible legend series without hiding the peer series', () => {
    const getCohortMedian = vi.fn();
    const {component, project} = makeHarness(getCohortMedian);

    getCohortMedian.mockReturnValue(of(makeResponse(project, 'ready')));
    initialise(component);

    component.onSelect('Target');

    expect(component.isDataShown('Target')).toBe(false);
    expect(component.isDataShown('Peer median (demo)')).toBe(true);
    expect(seriesNames(component)).not.toContain('Target');
    expect(component.temp.map((series) => series.name)).toContain('Target');

    component.onSelect('Target');

    expect(component.isDataShown('Target')).toBe(true);
    expect(seriesNames(component)).toContain('Target');
  });

  it('does not mistake a genuine all-zero series for a hidden series', () => {
    const getCohortMedian = vi.fn();
    const {component, project} = makeHarness(getCohortMedian, false);

    project.burndownChartData.push({
      key: 'Zero progress',
      values: [
        [project.unit.startDate.getTime(), 0],
        [project.unit.endDate.getTime(), 0],
      ],
    });

    initialise(component);

    expect(component.isDataShown('Zero progress')).toBe(true);
    expect(seriesNames(component)).toContain('Zero progress');
  });

  it('hides axis titles on narrow screens', () => {
    const {component} = makeHarness(vi.fn());
    const originalWidth = window.innerWidth;

    try {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 639,
      });

      component.onViewportResize();

      expect(component.showXAxisLabel).toBe(false);
      expect(component.showYAxisLabel).toBe(false);

      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 640,
      });

      component.onViewportResize();

      expect(component.showXAxisLabel).toBe(true);
      expect(component.showYAxisLabel).toBe(true);
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalWidth,
      });
    }
  });
});
