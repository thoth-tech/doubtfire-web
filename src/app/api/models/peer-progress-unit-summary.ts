import {PeerProgressIndicator} from './peer-progress-indicator';

/**
 * Unit-level PPI proof-of-concept model for PPI-F02.
 *
 * This model places the authenticated student's own unit progress beside an
 * anonymous cohort aggregate. It is a mock-backed frontend model and does not
 * represent a live unit-level API response.
 *
 * `studentPercentage` is the authenticated student's own unit progress. It may
 * remain available when the anonymous cohort percentage is suppressed,
 * unavailable, or stale. It is null when the student's own progress is
 * unavailable or when the feature is disabled.
 *
 * `taskDefinitionId` is omitted because this summary is not scoped to one task.
 */
export interface PeerProgressUnitSummary extends Omit<
  PeerProgressIndicator,
  | 'taskDefinitionId'
  | 'completedPercentage'
  | 'distributionAvailable'
  | 'statusDistribution'
  | 'isUserEnabled'
  | 'unavailableReason'
  | 'distributionUnavailableReason'
> {
  studentPercentage: number | null;
  /** Explicit scope for the anonymous metric (for example, DUE7 submissions). */
  cohortLabel?: string;
}
