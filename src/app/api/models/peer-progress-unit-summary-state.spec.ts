import {describe, expect, it} from 'vitest';
import {
  DISABLED_STATE,
  NORMAL_STATE,
  STALE_STATE,
  SUPPRESSED_STATE,
  UNAVAILABLE_STATE,
  ZERO_PERCENT_STATE,
} from 'src/app/demo/fixtures/peer-progress-demo.fixtures';
import {PeerProgressUnitSummary} from './peer-progress-unit-summary';
import {resolvePeerProgressUnitSummaryState} from './peer-progress-unit-summary-state';

type SharedCohortState =
  | typeof NORMAL_STATE
  | typeof ZERO_PERCENT_STATE
  | typeof SUPPRESSED_STATE
  | typeof UNAVAILABLE_STATE
  | typeof STALE_STATE
  | typeof DISABLED_STATE;

function toUnitSummary(
  cohort: SharedCohortState,
  studentPercentage: number | null,
): PeerProgressUnitSummary {
  return {
    unitId: cohort.unitId,
    targetGrade: cohort.targetGrade,
    studentPercentage,
    submittedPercentage: cohort.submittedPercentage,
    isSuppressed: cohort.isSuppressed,
    isStale: cohort.isStale,
    isFeatureEnabled: cohort.isFeatureEnabled,
    lastUpdatedAt: cohort.lastUpdatedAt,
    unavailableMessage: cohort.unavailableMessage,
  };
}

describe('resolvePeerProgressUnitSummaryState', () => {
  it('clears data while loading', () => {
    const result = resolvePeerProgressUnitSummaryState(true, null, toUnitSummary(NORMAL_STATE, 30));

    expect(result.state).toBe('loading');
    expect(result.data).toBeNull();
  });

  it('clears previous data when a request fails', () => {
    const result = resolvePeerProgressUnitSummaryState(
      false,
      new Error('network down'),
      toUnitSummary(NORMAL_STATE, 30),
    );

    expect(result.state).toBe('error');
    expect(result.data).toBeNull();
    expect(result.message).toBe('Could not load peer progress. Please try again.');
  });

  it('returns success with student and cohort percentages kept separate', () => {
    const summary = toUnitSummary(NORMAL_STATE, 30);
    const result = resolvePeerProgressUnitSummaryState(false, null, summary);

    expect(result.state).toBe('success');
    expect(result.data?.studentPercentage).toBe(30);
    expect(result.data?.submittedPercentage).toBe(NORMAL_STATE.submittedPercentage);
  });

  it('keeps a genuine cohort 0% different from unavailable data', () => {
    const result = resolvePeerProgressUnitSummaryState(
      false,
      null,
      toUnitSummary(ZERO_PERCENT_STATE, 0),
    );

    expect(result.state).toBe('no-data');
    expect(result.data?.studentPercentage).toBe(0);
    expect(result.data?.submittedPercentage).toBe(0);
  });

  it('removes a cohort percentage from a malformed suppressed response', () => {
    const unsafeSummary: PeerProgressUnitSummary = {
      ...toUnitSummary(SUPPRESSED_STATE, 30),
      submittedPercentage: 65,
    };

    const result = resolvePeerProgressUnitSummaryState(false, null, unsafeSummary);

    expect(result.state).toBe('hidden');
    expect(result.data?.studentPercentage).toBe(30);
    expect(result.data?.submittedPercentage).toBeNull();
    expect(result.message).toBe(SUPPRESSED_STATE.unavailableMessage);
  });

  it('keeps own progress but hides unavailable cohort progress', () => {
    const result = resolvePeerProgressUnitSummaryState(
      false,
      null,
      toUnitSummary(UNAVAILABLE_STATE, 30),
    );

    expect(result.state).toBe('unavailable');
    expect(result.data?.studentPercentage).toBe(30);
    expect(result.data?.submittedPercentage).toBeNull();
  });

  it('clears both percentages when the feature is disabled', () => {
    const unsafeSummary: PeerProgressUnitSummary = {
      ...toUnitSummary(DISABLED_STATE, 30),
      submittedPercentage: 65,
    };

    const result = resolvePeerProgressUnitSummaryState(false, null, unsafeSummary);

    expect(result.state).toBe('disabled');
    expect(result.data?.studentPercentage).toBeNull();
    expect(result.data?.submittedPercentage).toBeNull();
    expect(result.message).toBe(DISABLED_STATE.unavailableMessage);
  });

  it('keeps own progress but removes a malformed stale cohort percentage', () => {
    const unsafeSummary: PeerProgressUnitSummary = {
      ...toUnitSummary(STALE_STATE, 30),
      submittedPercentage: 65,
    };

    const result = resolvePeerProgressUnitSummaryState(false, null, unsafeSummary);

    expect(result.state).toBe('stale');
    expect(result.data?.studentPercentage).toBe(30);
    expect(result.data?.submittedPercentage).toBeNull();
    expect(result.message).toBe(STALE_STATE.unavailableMessage);
  });

  it('keeps a valid cohort percentage when the student percentage is missing', () => {
    // A missing student figure says nothing about the cohort data we were
    // given. The card renders the two panels independently, so the student
    // panel falls to "Your progress is unavailable." on its own and the cohort
    // panel keeps showing the number the API actually returned.
    const result = resolvePeerProgressUnitSummaryState(
      false,
      null,
      toUnitSummary(NORMAL_STATE, null),
    );

    expect(result.state).toBe('success');
    expect(result.data?.studentPercentage).toBeNull();
    expect(result.data?.submittedPercentage).toBe(NORMAL_STATE.submittedPercentage);
  });

  it('returns unavailable when the cohort percentage itself is missing', () => {
    const result = resolvePeerProgressUnitSummaryState(false, null, {
      ...toUnitSummary(NORMAL_STATE, 30),
      submittedPercentage: null,
    });

    expect(result.state).toBe('unavailable');
    expect(result.data?.submittedPercentage).toBeNull();
  });

  it('transitions from loading to success without carrying old data', () => {
    const loadingResult = resolvePeerProgressUnitSummaryState(true, null, null);

    expect(loadingResult.data).toBeNull();

    const summary = toUnitSummary(NORMAL_STATE, 30);
    const successResult = resolvePeerProgressUnitSummaryState(false, null, summary);

    expect(successResult.state).toBe('success');
    expect(successResult.data).toEqual(summary);
  });
});
