import {describe, expect, it} from 'vitest';
import {PORTFOLIO_GRADE_BANDS, gradeBandFor, isProjectGraded} from './portfolio-grades';

describe('portfolio grades', () => {
  it('treats the starting grade of 0 with no rationale as not graded', () => {
    expect(isProjectGraded({grade: 0, gradeRationale: null})).toBe(false);
    expect(isProjectGraded({grade: 0, gradeRationale: '   '})).toBe(false);
    expect(isProjectGraded({grade: null, gradeRationale: 'Late'})).toBe(false);
    expect(isProjectGraded(null)).toBe(false);
  });

  it('treats a saved 0 with a rationale, or any other mark, as graded', () => {
    expect(isProjectGraded({grade: 0, gradeRationale: 'Nothing was submitted'})).toBe(true);
    expect(isProjectGraded({grade: 75, gradeRationale: null})).toBe(true);
  });

  // The old list named two rows High Distinction.
  it('lists each grade band once', () => {
    const names = PORTFOLIO_GRADE_BANDS.map((band) => band.name);

    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(['Fail', 'Pass', 'Credit', 'Distinction', 'High Distinction']);
  });

  it('places a mark in its band by range, including marks the buttons do not offer', () => {
    expect(gradeBandFor(44)?.name).toBe('Fail');
    expect(gradeBandFor(50)?.name).toBe('Pass');
    expect(gradeBandFor(58)?.name).toBe('Pass');
    expect(gradeBandFor(79)?.name).toBe('Distinction');
    expect(gradeBandFor(100)?.name).toBe('High Distinction');
    expect(gradeBandFor(null)).toBeUndefined();
  });
});
