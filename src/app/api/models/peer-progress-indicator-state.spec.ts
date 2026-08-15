import {describe, expect, it} from 'vitest';
import {
  DISABLED_STATE,
  NORMAL_STATE,
  STALE_STATE,
  SUPPRESSED_STATE,
  UNAVAILABLE_STATE,
  ZERO_PERCENT_STATE,
} from '../services/mock';
import {resolvePeerProgressState} from './peer-progress-indicator-state';

describe('resolvePeerProgressState', () => {
  it('returns loading while the request is in flight, ignoring any data passed in', () => {
    const result = resolvePeerProgressState(true, null, NORMAL_STATE);
    expect(result.state).toBe('loading');
    expect(result.data).toBeNull();
  });

  it('returns error when the request fails, and does not leak the previous data', () => {
    const result = resolvePeerProgressState(false, new Error('network down'), NORMAL_STATE);
    expect(result.state).toBe('error');
    expect(result.data).toBeNull();
  });

  it('returns success for a normal response', () => {
    const result = resolvePeerProgressState(false, null, NORMAL_STATE);
    expect(result.state).toBe('success');
    expect(result.data).toEqual(NORMAL_STATE);
  });

  it('returns no-data when nobody has submitted yet', () => {
    const result = resolvePeerProgressState(false, null, ZERO_PERCENT_STATE);
    expect(result.state).toBe('no-data');
  });

  it('returns hidden with the API message for a suppressed response', () => {
    const result = resolvePeerProgressState(false, null, SUPPRESSED_STATE);
    expect(result.state).toBe('hidden');
    expect(result.message).toBe(SUPPRESSED_STATE.unavailableMessage);
  });

  it('returns unavailable for a generically unavailable response', () => {
    const result = resolvePeerProgressState(false, null, UNAVAILABLE_STATE);
    expect(result.state).toBe('unavailable');
  });

  it('returns disabled when the unit has turned the feature off', () => {
    const result = resolvePeerProgressState(false, null, DISABLED_STATE);
    expect(result.state).toBe('disabled');
    expect(result.message).toBe(DISABLED_STATE.unavailableMessage);
  });

  it('returns stale without exposing a percentage when data is outdated', () => {
    const result = resolvePeerProgressState(false, null, STALE_STATE);

    expect(result.state).toBe('stale');
    expect(result.data?.submittedPercentage).toBeNull();
    expect(result.message).toBe(STALE_STATE.unavailableMessage);
  });

  it('transitions from loading to success without carrying over a stale value', () => {
    const loadingResult = resolvePeerProgressState(true, null, null);
    expect(loadingResult.data).toBeNull();

    const successResult = resolvePeerProgressState(false, null, NORMAL_STATE);
    expect(successResult.data).toEqual(NORMAL_STATE);
  });

  it('transitions from loading to error without carrying over a stale value', () => {
    const loadingResult = resolvePeerProgressState(true, null, NORMAL_STATE);
    expect(loadingResult.data).toBeNull();

    const errorResult = resolvePeerProgressState(false, new Error('timeout'), null);
    expect(errorResult.state).toBe('error');
    expect(errorResult.data).toBeNull();
  });
});
