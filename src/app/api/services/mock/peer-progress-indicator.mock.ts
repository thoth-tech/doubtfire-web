import {PeerProgressIndicator} from '../../models/peer-progress-indicator';

export const NORMAL_STATE: PeerProgressIndicator = {
  taskDefinitionId: 0,
  unitId: 0,
  targetGrade: 0,
  submittedPercentage: 42,
  isSuppressed: false,
  isStale: false,
  isFeatureEnabled: true,
  lastUpdatedAt: new Date().toISOString(),
  unavailableMessage: '',
};

export const ZERO_PERCENT_STATE: PeerProgressIndicator = {
  taskDefinitionId: 0,
  unitId: 0,
  targetGrade: 0,
  submittedPercentage: 0,
  isSuppressed: false,
  isStale: false,
  isFeatureEnabled: true,
  lastUpdatedAt: new Date().toISOString(),
  unavailableMessage: '',
};

export const SUPPRESSED_STATE: PeerProgressIndicator = {
  taskDefinitionId: 0,
  unitId: 0,
  targetGrade: 0,
  submittedPercentage: null,
  isSuppressed: true,
  isStale: false,
  isFeatureEnabled: true,
  lastUpdatedAt: new Date().toISOString(),
  unavailableMessage: 'Not enough students to show progress.',
};

export const UNAVAILABLE_STATE: PeerProgressIndicator = {
  taskDefinitionId: 0,
  unitId: 0,
  targetGrade: 0,
  submittedPercentage: null,
  isSuppressed: false,
  isStale: false,
  isFeatureEnabled: true,
  lastUpdatedAt: new Date().toISOString(),
  unavailableMessage: 'Progress unavailable.',
};

export const STALE_STATE: PeerProgressIndicator = {
  taskDefinitionId: 0,
  unitId: 0,
  targetGrade: 0,
  submittedPercentage: null,
  isSuppressed: false,
  isStale: true,
  isFeatureEnabled: true,
  lastUpdatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  unavailableMessage: 'Peer progress is currently unavailable.',
};

export const DISABLED_STATE: PeerProgressIndicator = {
  taskDefinitionId: 0,
  unitId: 0,
  targetGrade: 0,
  submittedPercentage: null,
  isSuppressed: false,
  isStale: false,
  isFeatureEnabled: false,
  lastUpdatedAt: new Date().toISOString(),
  unavailableMessage: 'Peer Progress Indicator is disabled for this unit.',
};
