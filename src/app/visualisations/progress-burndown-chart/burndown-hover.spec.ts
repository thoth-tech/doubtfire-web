import {describe, expect, it} from 'vitest';
import {
  BurndownSeries,
  buildTooltip,
  burndownDates,
  describeTooltip,
  formatGap,
  nearestIndex,
  nearestSeriesAt,
  stepIndex,
  targetValueAt,
} from './burndown-hover';

const DATA: BurndownSeries[] = [
  {
    name: 'Target',
    series: [
      {name: '1 Jul', value: 100},
      {name: '8 Jul', value: 60},
      {name: '15 Jul', value: 0},
    ],
  },
  {
    name: 'Projected',
    series: [
      {name: '1 Jul', value: 100},
      {name: '8 Jul', value: 64},
      {name: '15 Jul', value: 30},
      {name: '22 Jul', value: 0},
    ],
  },
  {
    name: 'To Submit',
    series: [
      {name: '1 Jul', value: 90},
      {name: '8 Jul', value: 57},
    ],
  },
];
const COLORS = ['grey-1', 'grey-2', 'blue'];

describe('burndown hover helpers', () => {
  describe('nearest-date snapping', () => {
    const positions = [0, 50, 100, 150];

    it('snaps to the closest date position', () => {
      expect(nearestIndex(positions, 0)).toBe(0);
      expect(nearestIndex(positions, 24)).toBe(0);
      expect(nearestIndex(positions, 26)).toBe(1);
      expect(nearestIndex(positions, 149)).toBe(3);
    });

    it('clamps positions outside the plot to the first and last dates', () => {
      expect(nearestIndex(positions, -40)).toBe(0);
      expect(nearestIndex(positions, 400)).toBe(3);
    });

    it('prefers the earlier date on an exact midpoint and returns -1 with no dates', () => {
      expect(nearestIndex(positions, 75)).toBe(1);
      expect(nearestIndex([], 10)).toBe(-1);
    });

    it('builds the date domain in first-seen order like ngx-charts', () => {
      expect(burndownDates(DATA)).toEqual(['1 Jul', '8 Jul', '15 Jul', '22 Jul']);
    });
  });

  describe('tooltip rows', () => {
    it('lists each series with a value at the date, with its colour and a percent label', () => {
      const tooltip = buildTooltip(DATA, COLORS, burndownDates(DATA), 1, DATA[0]);

      expect(tooltip?.date).toBe('8 Jul');
      expect(tooltip?.rows.map((row) => [row.name, row.color, row.valueLabel])).toEqual([
        ['Target', 'grey-1', '60%'],
        ['Projected', 'grey-2', '64%'],
        ['To Submit', 'blue', '57%'],
      ]);
    });

    it('leaves out series that have ended before the date', () => {
      const tooltip = buildTooltip(DATA, COLORS, burndownDates(DATA), 2, DATA[0]);

      expect(tooltip?.rows.map((row) => row.name)).toEqual(['Target', 'Projected']);
    });

    it('returns null for a date that does not exist', () => {
      expect(buildTooltip(DATA, COLORS, burndownDates(DATA), 9, DATA[0])).toBeNull();
    });

    it('mirrors the tooltip as a sentence for the live region', () => {
      const tooltip = buildTooltip(DATA, COLORS, burndownDates(DATA), 1, DATA[0]);

      expect(describeTooltip(tooltip!)).toBe(
        '8 Jul. Target 60%. Projected 64%, +4% behind. To Submit 57%, 3% ahead.',
      );
    });
  });

  describe('ahead and behind', () => {
    it('labels work above Target as behind and below as ahead', () => {
      expect(formatGap(4)).toBe('+4% behind');
      expect(formatGap(-3)).toBe('3% ahead');
      expect(formatGap(0)).toBe('On target');
    });

    it('derives the gap from Target at the same date, and never on the Target row', () => {
      const rows = buildTooltip(DATA, COLORS, burndownDates(DATA), 1, DATA[0])!.rows;

      expect(rows[0].gap).toBeUndefined();
      expect(rows[1].gap).toEqual({delta: 4, label: '+4% behind'});
      expect(rows[2].gap).toEqual({delta: -3, label: '3% ahead'});
    });

    it('treats a date after Target reaches zero as a zero target', () => {
      const dates = burndownDates(DATA);

      expect(targetValueAt(DATA[0], dates, '22 Jul')).toBe(0);
      expect(buildTooltip(DATA, COLORS, dates, 3, DATA[0])!.rows[0].gap?.label).toBe('On target');
    });

    it('omits the gap when there is no Target series', () => {
      const rows = buildTooltip(DATA.slice(1), COLORS, burndownDates(DATA), 1)!.rows;

      expect(rows.every((row) => row.gap === undefined)).toBe(true);
    });
  });

  describe('keyboard stepping', () => {
    it('starts from the first date going right and the last date going left', () => {
      expect(stepIndex(null, 1, 4)).toBe(0);
      expect(stepIndex(null, -1, 4)).toBe(3);
    });

    it('moves one date at a time and stops at either end', () => {
      expect(stepIndex(1, 1, 4)).toBe(2);
      expect(stepIndex(1, -1, 4)).toBe(0);
      expect(stepIndex(0, -1, 4)).toBe(0);
      expect(stepIndex(3, 1, 4)).toBe(3);
      expect(stepIndex(2, 1, 0)).toBeNull();
    });
  });

  describe('line hit testing', () => {
    const positions = [0, 100];
    const ys = [
      [0, 100],
      [100, 100],
    ];

    it('finds the line under the pointer between two dates', () => {
      expect(nearestSeriesAt(positions, ys, 50, 52, 8)).toBe(0);
      expect(nearestSeriesAt(positions, ys, 50, 97, 8)).toBe(1);
    });

    it('ignores the pointer when no line is within the tolerance', () => {
      expect(nearestSeriesAt(positions, ys, 50, 75, 8)).toBe(-1);
    });
  });
});
