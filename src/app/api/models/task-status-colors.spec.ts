import {describe, expect, it} from 'vitest';
import {TaskStatus, TaskStatusEnum} from './task-status';

// WCAG relative luminance: compare each background against its actual chip
// foreground, including the three statuses which use dark text.
const luminance = (hex: string): number => {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrast = (background: string, foreground: string): number => {
  const values = [luminance(background), luminance(foreground)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

const darkForeground: TaskStatusEnum[] = ['not_started', 'fix_and_resubmit', 'assess_in_portfolio'];

describe('task status colours', () => {
  it.each(TaskStatus.STATUS_KEYS)(
    '%s has at least 4.5:1 contrast against its foreground',
    (status) => {
      const foreground = darkForeground.includes(status) ? '#444444' : '#ffffff';
      expect(contrast(TaskStatus.STATUS_COLORS.get(status), foreground)).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );

  it('detects the former low-contrast complete chip', () => {
    expect(contrast('#5bb75b', '#ffffff')).toBeCloseTo(2.507, 2);
    expect(contrast('#5bb75b', '#ffffff')).toBeLessThan(4.5);
  });
});
