import {describe, expect, it} from 'vitest';
import {CourseFlowCourse, CourseFlowSlot} from 'src/app/api/models/course-flow';
import {checkCourseFlowPlan} from './course-flow-checks';

const course: CourseFlowCourse = {
  id: 7,
  code: 'TEST',
  name: 'Test catalog',
  version: 'test-only',
  elective_count: 1,
  units: [
    {
      code: 'A',
      name: 'Required A',
      required: true,
      prerequisites: [],
      offered_trimesters: [1, 2, 3],
    },
    {
      code: 'B',
      name: 'Required B',
      required: true,
      prerequisites: ['A'],
      offered_trimesters: [1, 2],
    },
    {
      code: 'C',
      name: 'Elective C',
      required: false,
      prerequisites: ['B'],
      offered_trimesters: [1, 2, 3],
    },
    {
      code: 'D',
      name: 'Elective D',
      required: false,
      prerequisites: [],
      offered_trimesters: [1, 2, 3],
    },
  ],
};
const slot = (
  unit_code: string,
  year: number,
  trimester: number,
  position = 1,
): CourseFlowSlot => ({unit_code, year, trimester, position});

describe('Course Flow catalog planning checks', () => {
  it('reports every missing required unit and the configured elective count', () => {
    expect(checkCourseFlowPlan(course, []).map((issue) => [issue.code, issue.unit_code])).toEqual([
      ['missing_required', 'A'],
      ['missing_required', 'B'],
      ['elective_count', undefined],
    ]);
  });

  it('accepts a valid sequence across year boundaries independently of array order', () => {
    const plan = [slot('C', 2027, 2), slot('A', 2026, 3), slot('B', 2027, 1)];
    expect(checkCourseFlowPlan(course, plan)).toEqual([]);
  });

  it('rejects missing, concurrent and later prerequisites and unavailable trimesters', () => {
    const plan = [slot('A', 2026, 3, 2), slot('B', 2026, 3), slot('C', 2026, 2)];
    const issues = checkCourseFlowPlan(course, plan);
    expect(
      issues.filter((issue) => issue.code === 'prerequisite').map((issue) => issue.unit_code),
    ).toEqual(['B', 'C']);
    expect(
      issues.some((issue) => issue.code === 'unavailable_trimester' && issue.unit_code === 'B'),
    ).toBe(true);
    expect(
      checkCourseFlowPlan(course, [slot('C', 2026, 2)]).some(
        (issue) => issue.code === 'prerequisite',
      ),
    ).toBe(true);
  });

  it('reports surplus electives and follows a different catalog allowance', () => {
    const plan = [slot('A', 2026, 1), slot('B', 2026, 2), slot('C', 2026, 3), slot('D', 2027, 1)];
    expect(checkCourseFlowPlan(course, plan).map((issue) => issue.code)).toEqual([
      'elective_count',
    ]);
    expect(checkCourseFlowPlan({...course, elective_count: 2}, plan)).toEqual([]);
  });
});
