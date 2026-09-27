import {describe, expect, it} from 'vitest';
import {
  DISABLED_STATE,
  NORMAL_STATE,
  STALE_STATE,
  SUPPRESSED_STATE,
  UNAVAILABLE_STATE,
  USER_DISABLED_STATE,
  ZERO_PERCENT_STATE,
} from 'src/app/demo/fixtures/peer-progress-demo.fixtures';
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

  it('keeps a rounded zero distinct from unavailable data', () => {
    const result = resolvePeerProgressState(false, null, ZERO_PERCENT_STATE);
    expect(result.state).toBe('no-data');
  });

  it('returns hidden with the API message for a suppressed response', () => {
    const result = resolvePeerProgressState(false, null, SUPPRESSED_STATE);
    expect(result.state).toBe('hidden');
    expect(result.message).toBe(SUPPRESSED_STATE.unavailableMessage);
  });

  it('prioritises privacy suppression when a response is also stale', () => {
    const result = resolvePeerProgressState(false, null, {
      ...STALE_STATE,
      isSuppressed: true,
    });

    expect(result.state).toBe('hidden');
    expect(result.data?.submittedPercentage).toBeNull();
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

  it('returns preference-disabled without compact or detailed values when the user opts out', () => {
    const result = resolvePeerProgressState(false, null, USER_DISABLED_STATE);

    expect(result.state).toBe('preference-disabled');
    expect(result.data?.completedPercentage).toBeNull();
    expect(result.data?.submittedPercentage).toBeNull();
    expect(result.data?.statusDistribution).toEqual([]);
    expect(result.message).toContain('profile settings');
  });

  it('keeps an old API response usable as submission progress when completion is absent', () => {
    const result = resolvePeerProgressState(false, null, {
      ...NORMAL_STATE,
      completedPercentage: null,
    });

    expect(result.state).toBe('success');
    expect(result.data?.submittedPercentage).toBe(60);
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
