export interface PeerProgressIndicator {
  taskDefinitionId: number; // ID of the task definition
  unitId: number; // ID of the unit
  targetGrade: number; // Student’s selected target grade (0–3)

  submittedPercentage: number | null; // null when suppressed/unavailable/disabled
  isSuppressed: boolean; // true when cohort too small
  isStale: boolean; // true when data is outdated
  isFeatureEnabled: boolean; // false when unit disables PPI

  lastUpdatedAt: string; // ISO timestamp
  unavailableMessage: string; // safe message for suppressed/unavailable/stale/disabled
}
