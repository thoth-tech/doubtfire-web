import {CourseFlowCourse, CourseFlowIssue, CourseFlowSlot} from 'src/app/api/models/course-flow';

/** Immediate feedback while editing. The API repeats these checks on every save. */
export function checkCourseFlowPlan(
  course: CourseFlowCourse,
  slots: CourseFlowSlot[],
): CourseFlowIssue[] {
  const issues: CourseFlowIssue[] = [];
  const planned = new Map(slots.map((slot) => [slot.unit_code, slot]));
  const periodOrder = (slot: CourseFlowSlot): number => slot.year * 3 + slot.trimester;
  let electives = 0;
  for (const unit of course.units) {
    const slot = planned.get(unit.code);
    if (!slot) {
      if (unit.required) {
        issues.push({
          code: 'missing_required',
          unit_code: unit.code,
          message: `Required unit ${unit.code} is not planned.`,
        });
      }
      continue;
    }
    if (!unit.required) {
      electives++;
    }
    if (!unit.offered_trimesters.includes(slot.trimester)) {
      issues.push({
        code: 'unavailable_trimester',
        unit_code: unit.code,
        message: `${unit.code} is not offered in trimester ${slot.trimester} in this catalog.`,
      });
    }
    for (const prerequisite of unit.prerequisites) {
      const earlier = planned.get(prerequisite);
      if (!earlier || periodOrder(earlier) >= periodOrder(slot)) {
        issues.push({
          code: 'prerequisite',
          unit_code: unit.code,
          message: `Plan ${prerequisite} in an earlier study period than ${unit.code}.`,
        });
      }
    }
  }
  if (electives !== course.elective_count) {
    issues.push({
      code: 'elective_count',
      message: `Plan exactly ${course.elective_count} elective units; ${electives} are currently planned.`,
    });
  }
  return issues;
}
