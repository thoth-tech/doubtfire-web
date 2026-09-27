// Pure helpers behind the burndown chart's crosshair, tooltip and series emphasis.
// They take plain series data and pixel positions so they can be tested without
// rendering ngx-charts.

export interface BurndownPoint {
  name: string;
  value: number;
}

export interface BurndownSeries {
  name: string;
  series: BurndownPoint[];
}

export interface BurndownGap {
  /** Work remaining minus Target, in percentage points. Positive is behind. */
  delta: number;
  label: string;
}

export interface BurndownTooltipRow {
  name: string;
  color: string;
  value: number;
  valueLabel: string;
  gap?: BurndownGap;
}

export interface BurndownTooltip {
  date: string;
  rows: BurndownTooltipRow[];
}

export const TARGET_SERIES = 'Target';

/**
 * The x domain in the order ngx-charts builds it: every distinct point name, first
 * seen first, across the series on show.
 */
export function burndownDates(data: BurndownSeries[]): string[] {
  const seen: Set<string> = new Set();
  const dates: string[] = [];

  for (const series of data) {
    for (const point of series.series) {
      if (!seen.has(point.name)) {
        seen.add(point.name);
        dates.push(point.name);
      }
    }
  }

  return dates;
}

/** Index of the position closest to x. Ties go to the earlier date. -1 when empty. */
export function nearestIndex(positions: number[], x: number): number {
  let best = -1;
  let bestDistance = Infinity;

  positions.forEach((position, index) => {
    const distance = Math.abs(position - x);

    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });

  return best;
}

/** Moves an index by one step, starting from the nearest end when nothing is shown. */
export function stepIndex(current: number | null, delta: number, count: number): number | null {
  if (count <= 0) {
    return null;
  }

  if (current === null || current < 0 || current >= count) {
    return delta < 0 ? count - 1 : 0;
  }

  return Math.min(count - 1, Math.max(0, current + delta));
}

export function formatGap(delta: number): string {
  if (delta > 0) {
    return `+${delta}% behind`;
  }

  if (delta < 0) {
    return `${-delta}% ahead`;
  }

  return 'On target';
}

/**
 * Target work remaining at a date. Target stops once it reaches zero, so a date past
 * its last point reads as that last value.
 */
export function targetValueAt(
  target: BurndownSeries | undefined,
  dates: string[],
  date: string,
): number | undefined {
  if (!target || target.series.length === 0) {
    return undefined;
  }

  const point = target.series.find((entry) => entry.name === date);

  if (point) {
    return point.value;
  }

  const last = target.series[target.series.length - 1];
  const lastIndex = dates.indexOf(last.name);
  const dateIndex = dates.indexOf(date);

  return lastIndex >= 0 && dateIndex > lastIndex ? last.value : undefined;
}

/** One row per series on show that has a value at the date, in chart order. */
export function buildTooltip(
  data: BurndownSeries[],
  colors: string[],
  dates: string[],
  index: number,
  target?: BurndownSeries,
): BurndownTooltip | null {
  const date = dates[index];

  if (date === undefined) {
    return null;
  }

  const targetValue = targetValueAt(target, dates, date);
  const rows: BurndownTooltipRow[] = [];

  data.forEach((series, seriesIndex) => {
    const point = series.series.find((entry) => entry.name === date);

    if (!point) {
      return;
    }

    const row: BurndownTooltipRow = {
      name: series.name,
      color: colors[seriesIndex],
      value: point.value,
      valueLabel: `${point.value}%`,
    };

    if (series.name !== TARGET_SERIES && targetValue !== undefined) {
      const delta = point.value - targetValue;
      row.gap = {delta, label: formatGap(delta)};
    }

    rows.push(row);
  });

  return {date, rows};
}

/** Screen reader copy for the same tooltip. */
export function describeTooltip(tooltip: BurndownTooltip): string {
  const rows = tooltip.rows.map((row) =>
    row.gap ? `${row.name} ${row.valueLabel}, ${row.gap.label}` : `${row.name} ${row.valueLabel}`,
  );

  return [tooltip.date, ...rows].join('. ') + '.';
}

/**
 * The series whose line passes closest to (x, y), if any is within the tolerance.
 * `ys[s][d]` is series s at date d in pixels, or undefined where it has no point.
 * Lines are straight between points, matching the chart's linear curve.
 */
export function nearestSeriesAt(
  positions: number[],
  ys: (number | undefined)[][],
  x: number,
  y: number,
  tolerance: number,
): number {
  if (positions.length === 0) {
    return -1;
  }

  let right = positions.findIndex((position) => position >= x);

  if (right === -1) {
    right = positions.length - 1;
  }

  const left = Math.max(0, positions[right] === x ? right : right - 1);
  let best = -1;
  let bestDistance = tolerance;

  ys.forEach((values, seriesIndex) => {
    const a = values[left];
    const b = values[right];
    let lineY: number | undefined;

    if (a !== undefined && b !== undefined && positions[right] !== positions[left]) {
      const t = (x - positions[left]) / (positions[right] - positions[left]);
      lineY = a + (b - a) * Math.min(1, Math.max(0, t));
    } else if (a !== undefined && Math.abs(x - positions[left]) <= tolerance) {
      // The line ends at this point, so only its end cap is hoverable.
      lineY = a;
    } else if (b !== undefined && Math.abs(positions[right] - x) <= tolerance) {
      lineY = b;
    }

    if (lineY === undefined) {
      return;
    }

    const distance = Math.abs(lineY - y);

    if (distance <= bestDistance) {
      best = seriesIndex;
      bestDistance = distance;
    }
  });

  return best;
}
