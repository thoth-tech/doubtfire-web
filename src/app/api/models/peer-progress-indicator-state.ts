import {PeerProgressIndicator} from './peer-progress-indicator';

export type PeerProgressUiState =
  | 'loading'
  | 'success'
  | 'no-data'
  | 'hidden'
  | 'unavailable'
  | 'disabled'
  | 'stale'
  | 'error';

export interface PeerProgressViewModel {
  state: PeerProgressUiState;
  data: PeerProgressIndicator | null;
  message: string | null;
}

const GENERIC_ERROR_MESSAGE = 'Could not load peer progress. Please try again.';

// Prevents old peer data from being visible after an error or new request.
export function resolvePeerProgressState(
  loading: boolean,
  error: unknown | null,
  data: PeerProgressIndicator | null,
): PeerProgressViewModel {
  if (loading) {
    return {state: 'loading', data: null, message: null};
  }

  if (error || !data) {
    return {state: 'error', data: null, message: GENERIC_ERROR_MESSAGE};
  }

  if (!data.isFeatureEnabled) {
    return {state: 'disabled', data, message: data.unavailableMessage};
  }

  if (data.isSuppressed) {
    return {state: 'hidden', data, message: data.unavailableMessage};
  }

  if (data.isStale) {
    return {state: 'stale', data, message: data.unavailableMessage};
  }

  if (data.submittedPercentage === null) {
    return {state: 'unavailable', data, message: data.unavailableMessage};
  }

  if (data.submittedPercentage === 0) {
    return {state: 'no-data', data, message: null};
  }

  return {state: 'success', data, message: null};
}
