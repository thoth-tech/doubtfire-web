import {describe, expect, it, vi} from 'vitest';
import {ViewContainerRef} from '@angular/core';
import {PeerProgressService, Project} from 'src/app/api/models/doubtfire-model';
import {ThemeColorService} from 'src/app/common/theme/theme-color.service';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {ProgressBurndownChartComponent} from './progress-burndown-chart.component';

describe('ProgressBurndownChartComponent hover interactions', () => {
  function makeComponent(): ProgressBurndownChartComponent {
    const startDate = new Date(2026, 6, 1);
    const middle = new Date(2026, 6, 29);
    const endDate = new Date(2026, 7, 26);
    const series = (key: string, values: number[]) => ({
      key,
      values: [startDate, middle, endDate].map((date, index) => [date.getTime(), values[index]]),
    });

    const project = {
      id: 1,
      targetGrade: 0,
      unit: {startDate, endDate},
      burndownChartData: [
        series('Target', [1, 0.5, 0]),
        series('Projected', [1, 0.57, 0.1]),
        series('To Submit', [0.9, 0.4, 0.2]),
        series('To Complete', [0.95, 0.6, 0.3]),
      ],
      refreshBurndownChartData: vi.fn(),
    } as unknown as Project;

    const component = new ProgressBurndownChartComponent(
      {} as ViewContainerRef,
      {getCohortMedian: vi.fn()} as unknown as PeerProgressService,
      {enabled: false} as DemoModeStore,
      'en-US',
      {token: (name: string) => name} as unknown as ThemeColorService,
    );

    component.project = project;
    component.unit = project.unit;
    component.grade = project.targetGrade;
    component.ngOnInit();

    return component;
  }

  function key(name: string): KeyboardEvent {
    return new KeyboardEvent('keydown', {key: name, cancelable: true});
  }

  describe('keyboard stepping', () => {
    it('steps the crosshair through the dates with the arrow keys', () => {
      const component = makeComponent();
      const right = key('ArrowRight');

      component.onPlotKeydown(right);

      expect(right.defaultPrevented).toBe(true);
      expect(component.crosshairVisible).toBe(true);
      expect(component.hoverIndex).toBe(0);
      expect(component.tooltip?.date).toBe('1 Jul');

      component.onPlotKeydown(key('ArrowRight'));
      expect(component.hoverIndex).toBe(1);
      expect(component.tooltip?.date).toBe('29 Jul');

      component.onPlotKeydown(key('ArrowRight'));
      component.onPlotKeydown(key('ArrowRight'));
      expect(component.hoverIndex).toBe(2);

      component.onPlotKeydown(key('ArrowLeft'));
      expect(component.hoverIndex).toBe(1);
    });

    it('starts from the latest date when stepping left', () => {
      const component = makeComponent();

      component.onPlotKeydown(key('ArrowLeft'));

      expect(component.hoverIndex).toBe(2);
      expect(component.tooltip?.date).toBe('26 Aug');
    });

    it('fills the tooltip and the live region for the stepped date', () => {
      const component = makeComponent();

      component.onPlotKeydown(key('ArrowRight'));
      component.onPlotKeydown(key('ArrowRight'));

      expect(
        component.tooltip?.rows.map((row) => [row.name, row.valueLabel, row.gap?.label]),
      ).toEqual([
        ['Target', '50%', undefined],
        ['Projected', '57%', '+7% behind'],
        ['To Submit', '40%', '10% ahead'],
        ['To Complete', '60%', '+10% behind'],
      ]);
      expect(component.liveText).toBe(
        '29 Jul. Target 50%. Projected 57%, +7% behind. To Submit 40%, 10% ahead. To Complete 60%, +10% behind.',
      );
      expect(component.dots.every((dot) => dot.visible)).toBe(true);
    });

    it('hides everything on Escape and leaves other keys alone', () => {
      const component = makeComponent();

      component.onPlotKeydown(key('ArrowRight'));
      const escape = key('Escape');
      component.onPlotKeydown(escape);

      expect(escape.defaultPrevented).toBe(true);
      expect(component.crosshairVisible).toBe(false);
      expect(component.hoverIndex).toBeNull();
      expect(component.liveText).toBe('');
      expect(component.dots.some((dot) => dot.visible)).toBe(false);

      const tab = key('Tab');
      component.onPlotKeydown(tab);
      expect(tab.defaultPrevented).toBe(false);
      expect(component.crosshairVisible).toBe(false);
    });

    it('describes the chart in the plot label', () => {
      const component = makeComponent();

      expect(component.plotAriaLabel).toContain('Projected 10% remaining');
      expect(component.plotAriaLabel).toContain('arrow keys');
    });
  });

  describe('series emphasis', () => {
    it('emphasises the hovered legend series and dims the others', () => {
      const component = makeComponent();

      component.emphasiseSeries('To Submit');

      expect(component.activeEntries).toEqual([{name: 'To Submit'}]);
      expect(component.emphasisedSeries).toBe('To Submit');
      expect(component.isDimmed('To Submit')).toBe(false);
      expect(component.isDimmed('Projected')).toBe(true);

      component.emphasiseSeries(null);

      expect(component.activeEntries).toEqual([]);
      expect(component.isDimmed('Projected')).toBe(false);
    });

    it('does not emphasise a series that is hidden, and drops emphasis when it is hidden', () => {
      const component = makeComponent();

      component.emphasiseSeries('To Complete');
      component.toggleSeries('To Complete');

      expect(component.activeEntries).toEqual([]);

      component.emphasiseSeries('To Complete');
      expect(component.activeEntries).toEqual([]);

      component.toggleSeries('To Complete');
      expect(component.activeEntries).toEqual([{name: 'To Complete'}]);
    });

    it('puts the emphasis back when the chart clears its own active entries', () => {
      const component = makeComponent();

      component.emphasiseSeries('To Submit');
      const entries = component.activeEntries;
      component.onChartDeactivate();

      expect(component.activeEntries).not.toBe(entries);
      expect(component.activeEntries).toEqual([{name: 'To Submit'}]);
    });

    it('keeps the same entries array while the emphasised series is unchanged', () => {
      const component = makeComponent();

      component.emphasiseSeries('Projected');
      const entries = component.activeEntries;
      component.emphasiseSeries('Projected');

      expect(component.activeEntries).toBe(entries);
    });
  });
});
