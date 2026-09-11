import {describe, expect, it} from 'vitest';
import {
  calculateCompletionPercentage,
  calculateProgressComparison,
} from './ppi-progress-calculation.service';

describe('PPI progress calculations', () => {
  describe('calculateCompletionPercentage', () => {
    it('returns 0 when no tasks are completed', () => {
      expect(calculateCompletionPercentage(0, 20)).toBe(0);
    });

    it('calculates partial completion', () => {
      expect(calculateCompletionPercentage(5, 20)).toBe(25);
    });

    it('returns 100 when all tasks are completed', () => {
      expect(calculateCompletionPercentage(20, 20)).toBe(100);
    });

    it('returns null when no tasks are available', () => {
      expect(calculateCompletionPercentage(0, 0)).toBeNull();
    });

    it('returns null when completed tasks exceed available tasks', () => {
      expect(calculateCompletionPercentage(25, 20)).toBeNull();
    });

    it('rounds to the nearest whole percentage', () => {
      expect(calculateCompletionPercentage(2, 3)).toBe(67);
    });
  });

  describe('calculateProgressComparison', () => {
    it('returns a positive value when student is ahead', () => {
      expect(calculateProgressComparison(60, 50)).toBe(10);
    });

    it('returns a negative value when student is behind', () => {
      expect(calculateProgressComparison(40, 50)).toBe(-10);
    });

    it('returns zero when student matches the cohort', () => {
      expect(calculateProgressComparison(50, 50)).toBe(0);
    });

    it('returns null when cohort data is unavailable', () => {
      expect(calculateProgressComparison(50, null)).toBeNull();
    });
  });
});
