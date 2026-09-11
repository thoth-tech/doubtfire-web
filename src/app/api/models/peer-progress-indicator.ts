import {TaskStatusEnum} from './task-status';

export interface PeerProgressStatusDistributionEntry {
  status: TaskStatusEnum;
  percentage: number;
}

export type PeerProgressUnavailableReason =
  | 'user_disabled'
  | 'feature_disabled'
  | 'target_grade_unavailable'
  | 'snapshot_unavailable'
  | 'insufficient_cohort'
  | 'aggregation_incomplete'
  | 'stale';

export type PeerProgressDistributionUnavailableReason =
  | 'detailed_data_unavailable'
  | 'privacy_protection'
  | PeerProgressUnavailableReason;

export interface PeerProgressIndicator {
  taskDefinitionId: number; // ID of the task definition
  unitId: number; // ID of the unit
  targetGrade: number | null; // Valid server-side target grade, or null when unavailable

  submittedPercentage: number | null; // null when suppressed/unavailable/disabled
  completedPercentage: number | null; // null when suppressed/unavailable/disabled
  distributionAvailable: boolean; // false when a detailed vector cannot be shown safely
  statusDistribution: PeerProgressStatusDistributionEntry[]; // privacy-safe, quantised values only
  isUserEnabled: boolean; // false when the student's profile preference disables PPI
  isSuppressed: boolean; // true when cohort too small
  isStale: boolean; // true when data is outdated
  isFeatureEnabled: boolean; // false when unit disables PPI

  lastUpdatedAt: string | null; // ISO timestamp, or null when no snapshot was used
  unavailableMessage: string; // safe message for suppressed/unavailable/stale/disabled
  unavailableReason: PeerProgressUnavailableReason | null;
  distributionUnavailableReason: PeerProgressDistributionUnavailableReason | null;
}
