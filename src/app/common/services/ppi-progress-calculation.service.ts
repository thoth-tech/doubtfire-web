export function calculateCompletionPercentage(completed: number, available: number): number | null {
  if (
    !Number.isFinite(completed) ||
    !Number.isFinite(available) ||
    completed < 0 ||
    available <= 0 ||
    completed > available
  ) {
    return null;
  }

  return Math.round((completed / available) * 100);
}

export function calculateProgressComparison(
  studentPercentage: number,
  cohortPercentage: number | null,
): number | null {
  if (
    cohortPercentage === null ||
    !Number.isFinite(studentPercentage) ||
    !Number.isFinite(cohortPercentage) ||
    studentPercentage < 0 ||
    studentPercentage > 100 ||
    cohortPercentage < 0 ||
    cohortPercentage > 100
  ) {
    return null;
  }

  return Math.round(studentPercentage - cohortPercentage);
}
