import {PeerProgressState} from 'src/app/api/models/peer-progress';
import {PeerProgressIndicator} from 'src/app/api/models/peer-progress-indicator';
import {PeerProgressUnitSummary} from 'src/app/api/models/peer-progress-unit-summary';

export const DEMO_STATUS_DISTRIBUTION: PeerProgressIndicator['statusDistribution'] = [
  {status: 'not_started', percentage: 20},
  {status: 'feedback_exceeded', percentage: 0},
  {status: 'redo', percentage: 10},
  {status: 'need_help', percentage: 0},
  {status: 'working_on_it', percentage: 20},
  {status: 'fix_and_resubmit', percentage: 10},
  {status: 'ready_for_feedback', percentage: 20},
  {status: 'discuss', percentage: 0},
  {status: 'demonstrate', percentage: 0},
  {status: 'complete', percentage: 10},
  {status: 'fail', percentage: 10},
  {status: 'time_exceeded', percentage: 0},
  {status: 'assess_in_portfolio', percentage: 0},
  {status: 'attention_required', percentage: 0},
  {status: 'rediscuss', percentage: 0},
];

export type DemoPeerProgressState =
  | 'normal'
  | 'zero'
  | 'suppressed'
  | 'unavailable'
  | 'stale'
  | 'disabled';

const currentTimestamp = (): string => new Date().toISOString();

export const NORMAL_STATE: PeerProgressIndicator = {
  taskDefinitionId: 0,
  unitId: 0,
  targetGrade: 0,
  submittedPercentage: 60,
  completedPercentage: 10,
  distributionAvailable: true,
  statusDistribution: DEMO_STATUS_DISTRIBUTION,
  isUserEnabled: true,
  isSuppressed: false,
  isStale: false,
  isFeatureEnabled: true,
  lastUpdatedAt: currentTimestamp(),
  unavailableMessage: '',
  unavailableReason: null,
  distributionUnavailableReason: null,
};

export const ROUNDED_90_STATE: PeerProgressIndicator = {
  ...NORMAL_STATE,
  submittedPercentage: 50,
  completedPercentage: 20,
  statusDistribution: DEMO_STATUS_DISTRIBUTION.map((entry) => {
    switch (entry.status) {
      case 'ready_for_feedback':
        return {...entry, percentage: 10};
      case 'complete':
        return {...entry, percentage: 20};
      case 'fail':
        return {...entry, percentage: 0};
      default:
        return {...entry};
    }
  }),
};

export const ROUNDED_110_STATE: PeerProgressIndicator = {
  ...NORMAL_STATE,
  submittedPercentage: 80,
  completedPercentage: 30,
  statusDistribution: DEMO_STATUS_DISTRIBUTION.map((entry) => {
    switch (entry.status) {
      case 'not_started':
        return {...entry, percentage: 10};
      case 'complete':
        return {...entry, percentage: 30};
      default:
        return {...entry};
    }
  }),
};

export const ZERO_PERCENT_STATE: PeerProgressIndicator = {
  ...NORMAL_STATE,
  submittedPercentage: 0,
  completedPercentage: 0,
  statusDistribution: [
    {status: 'not_started', percentage: 50},
    {status: 'feedback_exceeded', percentage: 0},
    {status: 'redo', percentage: 0},
    {status: 'need_help', percentage: 10},
    {status: 'working_on_it', percentage: 30},
    {status: 'fix_and_resubmit', percentage: 10},
    {status: 'ready_for_feedback', percentage: 0},
    {status: 'discuss', percentage: 0},
    {status: 'demonstrate', percentage: 0},
    {status: 'complete', percentage: 0},
    {status: 'fail', percentage: 0},
    {status: 'time_exceeded', percentage: 0},
    {status: 'assess_in_portfolio', percentage: 0},
    {status: 'attention_required', percentage: 0},
    {status: 'rediscuss', percentage: 0},
  ],
};

export const SUPPRESSED_STATE: PeerProgressIndicator = {
  ...NORMAL_STATE,
  submittedPercentage: null,
  completedPercentage: null,
  distributionAvailable: false,
  statusDistribution: [],
  isSuppressed: true,
  unavailableMessage: 'Not enough students to show progress.',
  unavailableReason: 'insufficient_cohort',
  distributionUnavailableReason: 'insufficient_cohort',
};

export const UNAVAILABLE_STATE: PeerProgressIndicator = {
  ...NORMAL_STATE,
  submittedPercentage: null,
  completedPercentage: null,
  distributionAvailable: false,
  statusDistribution: [],
  unavailableMessage: 'Progress unavailable.',
  unavailableReason: 'snapshot_unavailable',
  distributionUnavailableReason: 'snapshot_unavailable',
};

export const STALE_STATE: PeerProgressIndicator = {
  ...NORMAL_STATE,
  submittedPercentage: null,
  completedPercentage: null,
  distributionAvailable: false,
  statusDistribution: [],
  isStale: true,
  lastUpdatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  unavailableMessage: 'Peer progress is currently unavailable.',
  unavailableReason: 'stale',
  distributionUnavailableReason: 'stale',
};

export const DISABLED_STATE: PeerProgressIndicator = {
  ...NORMAL_STATE,
  submittedPercentage: null,
  completedPercentage: null,
  distributionAvailable: false,
  statusDistribution: [],
  isFeatureEnabled: false,
  unavailableMessage: 'Peer Progress Indicator is disabled for this unit.',
  unavailableReason: 'feature_disabled',
  distributionUnavailableReason: 'feature_disabled',
};

export const DETAIL_PROTECTED_STATE: PeerProgressIndicator = {
  ...NORMAL_STATE,
  submittedPercentage: 70,
  completedPercentage: 30,
  distributionAvailable: false,
  statusDistribution: [],
  distributionUnavailableReason: 'privacy_protection',
};

export const USER_DISABLED_STATE: PeerProgressIndicator = {
  ...NORMAL_STATE,
  submittedPercentage: null,
  completedPercentage: null,
  distributionAvailable: false,
  statusDistribution: [],
  isUserEnabled: false,
  unavailableMessage: 'Peer progress is turned off in your profile settings.',
  unavailableReason: 'user_disabled',
  distributionUnavailableReason: 'user_disabled',
};

export const DEMO_WEEKLY_REMAINING: readonly number[] = [
  1.0, 0.98, 0.93, 0.88, 0.8, 0.73, 0.66, 0.58, 0.51, 0.44, 0.36, 0.28, 0.2, 0.13, 0.07, 0.02, 0.0,
];

export const DEMO_PEER_MEDIAN_STATE: PeerProgressState = 'ready';

export function createDemoUnitSummary(
  unitId: number,
  targetGrade: number,
  studentPercentage: number | null,
  state: DemoPeerProgressState = 'normal',
): PeerProgressUnitSummary {
  const cohort = demoPeerProgressState(state);

  return {
    unitId,
    targetGrade,
    studentPercentage,
    submittedPercentage: cohort.submittedPercentage,
    isSuppressed: cohort.isSuppressed,
    isStale: cohort.isStale,
    isFeatureEnabled: cohort.isFeatureEnabled,
    lastUpdatedAt: cohort.lastUpdatedAt,
    unavailableMessage: cohort.unavailableMessage,
  };
}

export function createMaskedPeerProgressIndicator(taskDefinitionId: number): PeerProgressIndicator {
  return {
    ...DISABLED_STATE,
    taskDefinitionId,
    unavailableMessage: 'Enable demo mode to show live peer comparison data.',
  };
}

function demoPeerProgressState(state: DemoPeerProgressState): PeerProgressIndicator {
  switch (state) {
    case 'normal':
      return NORMAL_STATE;
    case 'zero':
      return ZERO_PERCENT_STATE;
    case 'suppressed':
      return SUPPRESSED_STATE;
    case 'unavailable':
      return UNAVAILABLE_STATE;
    case 'stale':
      return STALE_STATE;
    case 'disabled':
      return DISABLED_STATE;
  }
}
