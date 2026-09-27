/** Versioned catalog rules for planning; these do not certify degree eligibility. */
export interface CourseFlowUnit {
  code: string;
  name: string;
  required: boolean;
  prerequisites: string[];
  offered_trimesters: number[];
}

export interface CourseFlowCourse {
  id: number;
  code: string;
  name: string;
  version: string;
  elective_count: number;
  units: CourseFlowUnit[];
}

export interface CourseFlowPeriod {
  year: number;
  trimester: number;
}

export interface CourseFlowSlot extends CourseFlowPeriod {
  unit_code: string;
  position: number;
}

export interface CourseFlowIssue {
  code: 'missing_required' | 'elective_count' | 'prerequisite' | 'unavailable_trimester';
  message: string;
  unit_code?: string;
}

export interface CourseFlowDraft {
  course_id: number;
  name: string;
  periods: CourseFlowPeriod[];
  slots: CourseFlowSlot[];
}

export interface CourseFlowMap extends CourseFlowDraft {
  id: number;
  lock_version: number;
  issues: CourseFlowIssue[];
  complete: boolean;
  updated_at: string;
}
