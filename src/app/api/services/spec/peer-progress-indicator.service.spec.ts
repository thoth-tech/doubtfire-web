import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {provideHttpClient, withInterceptorsFromDi, withXhr} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {PeerProgressIndicator} from 'src/app/api/models/peer-progress-indicator';
import API_URL from 'src/app/config/constants/apiUrl';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {
  DEMO_STATUS_DISTRIBUTION,
  DISABLED_STATE,
  NORMAL_STATE,
  SUPPRESSED_STATE,
} from 'src/app/demo/fixtures/peer-progress-demo.fixtures';
import {PeerProgressIndicatorService} from '../peer-progress-indicator.service';

describe('PeerProgressIndicatorService', () => {
  let service: PeerProgressIndicatorService;
  let httpMock: HttpTestingController;
  let demoMode: {shouldMaskApiData: boolean};

  beforeEach(() => {
    demoMode = {shouldMaskApiData: false};
    TestBed.configureTestingModule({
      providers: [
        PeerProgressIndicatorService,
        {provide: DemoModeStore, useValue: demoMode},
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(PeerProgressIndicatorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify({ignoreCancelled: true});
  });

  it('requests the authorised project/task route without client-supplied cohort parameters', () => {
    service.getIndicator(7, 99).subscribe();

    const request = httpMock.expectOne(`${API_URL}/projects/7/task_def_id/99/peer_progress`);

    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);

    request.flush({
      task_definition_id: 99,
      unit_id: 1,
      target_grade: 2,
      submitted_percentage: 40,
      is_suppressed: false,
      is_stale: false,
      is_feature_enabled: true,
      last_updated_at: '2026-08-23T00:00:00Z',
      unavailable_message: '',
    });
  });

  it('maps the complete snake-case response and preserves nullable fields', () => {
    let result: PeerProgressIndicator | undefined;

    service.getIndicator(7, 99).subscribe((value) => {
      result = value;
    });

    httpMock.expectOne(`${API_URL}/projects/7/task_def_id/99/peer_progress`).flush({
      task_definition_id: 99,
      unit_id: 1,
      target_grade: null,
      submitted_percentage: null,
      is_suppressed: false,
      is_stale: false,
      is_feature_enabled: true,
      last_updated_at: null,
      unavailable_message: 'Peer progress is currently unavailable.',
    });

    expect(result).toEqual({
      taskDefinitionId: 99,
      unitId: 1,
      targetGrade: null,
      submittedPercentage: null,
      completedPercentage: null,
      distributionAvailable: false,
      statusDistribution: [],
      isUserEnabled: true,
      isSuppressed: false,
      isStale: false,
      isFeatureEnabled: true,
      lastUpdatedAt: null,
      unavailableMessage: 'Peer progress is currently unavailable.',
      unavailableReason: null,
      distributionUnavailableReason: null,
    });
  });

  it('maps the full quantised status distribution and compact completion metric', () => {
    let result: PeerProgressIndicator | undefined;

    service.getIndicator(7, 99).subscribe((value) => {
      result = value;
    });

    httpMock.expectOne(`${API_URL}/projects/7/task_def_id/99/peer_progress`).flush({
      task_definition_id: 99,
      unit_id: 1,
      target_grade: 2,
      submitted_percentage: 60,
      completed_percentage: 10,
      distribution_available: true,
      status_distribution: DEMO_STATUS_DISTRIBUTION,
      is_user_enabled: true,
      is_suppressed: false,
      is_stale: false,
      is_feature_enabled: true,
      last_updated_at: '2026-08-23T00:00:00Z',
      unavailable_message: '',
      unavailable_reason: null,
      distribution_unavailable_reason: null,
    });

    expect(result).toMatchObject({
      submittedPercentage: 60,
      completedPercentage: 10,
      distributionAvailable: true,
      statusDistribution: DEMO_STATUS_DISTRIBUTION,
      isUserEnabled: true,
    });
  });

  it.each([
    ['a missing canonical status', DEMO_STATUS_DISTRIBUTION.slice(0, -1)],
    ['a duplicate status', [...DEMO_STATUS_DISTRIBUTION.slice(0, -1), DEMO_STATUS_DISTRIBUTION[0]]],
    [
      'an unknown status',
      [...DEMO_STATUS_DISTRIBUTION.slice(0, -1), {status: 'unknown_status', percentage: 0}],
    ],
    [
      'a non-quantised percentage',
      DEMO_STATUS_DISTRIBUTION.map((entry, index) =>
        index === 0 ? {...entry, percentage: 15} : entry,
      ),
    ],
  ])('fails the entire detailed vector closed for %s', (_label, statusDistribution) => {
    let result: PeerProgressIndicator | undefined;

    service.getIndicator(7, 99).subscribe((value) => {
      result = value;
    });

    httpMock.expectOne(`${API_URL}/projects/7/task_def_id/99/peer_progress`).flush({
      task_definition_id: 99,
      unit_id: 1,
      target_grade: 2,
      submitted_percentage: 60,
      completed_percentage: 10,
      distribution_available: true,
      status_distribution: statusDistribution,
      is_user_enabled: true,
      is_suppressed: false,
      is_stale: false,
      is_feature_enabled: true,
      last_updated_at: '2026-08-23T00:00:00Z',
      unavailable_message: '',
      distribution_unavailable_reason: 'detailed_data_unavailable',
    });

    expect(result?.distributionAvailable).toBe(false);
    expect(result?.statusDistribution).toEqual([]);
    expect(result?.completedPercentage).toBe(10);
  });

  it('scrubs every compact and detailed value when the server reports the user preference off', () => {
    let result: PeerProgressIndicator | undefined;

    service.getIndicator(7, 99).subscribe((value) => {
      result = value;
    });

    httpMock.expectOne(`${API_URL}/projects/7/task_def_id/99/peer_progress`).flush({
      task_definition_id: 99,
      unit_id: 1,
      target_grade: 2,
      submitted_percentage: 60,
      completed_percentage: 10,
      distribution_available: true,
      status_distribution: DEMO_STATUS_DISTRIBUTION,
      is_user_enabled: false,
      is_suppressed: false,
      is_stale: false,
      is_feature_enabled: true,
      last_updated_at: '2026-08-23T00:00:00Z',
      unavailable_message: 'server-provided preference detail',
      unavailable_reason: 'user_disabled',
      distribution_unavailable_reason: 'user_disabled',
    });

    expect(result).toMatchObject({
      submittedPercentage: null,
      completedPercentage: null,
      distributionAvailable: false,
      statusDistribution: [],
      isUserEnabled: false,
      unavailableReason: 'user_disabled',
    });
  });

  it('scrubs compact and detailed values from a suppressed response even if the payload is malformed', () => {
    let result: PeerProgressIndicator | undefined;

    service.getIndicator(7, 99).subscribe((value) => {
      result = value;
    });

    httpMock.expectOne(`${API_URL}/projects/7/task_def_id/99/peer_progress`).flush({
      task_definition_id: 99,
      unit_id: 1,
      target_grade: 2,
      submitted_percentage: 60,
      completed_percentage: 10,
      distribution_available: true,
      status_distribution: DEMO_STATUS_DISTRIBUTION,
      is_user_enabled: true,
      is_suppressed: true,
      is_stale: false,
      is_feature_enabled: true,
      last_updated_at: '2026-08-23T00:00:00Z',
      unavailable_message: 'Not enough students to show progress.',
      unavailable_reason: 'insufficient_cohort',
      distribution_unavailable_reason: 'insufficient_cohort',
    });

    expect(result).toMatchObject({
      submittedPercentage: null,
      completedPercentage: null,
      distributionAvailable: false,
      statusDistribution: [],
      isSuppressed: true,
    });
  });

  it('does not retain unrecognised reason strings from the API', () => {
    let result: PeerProgressIndicator | undefined;

    service.getIndicator(7, 99).subscribe((value) => {
      result = value;
    });

    httpMock.expectOne(`${API_URL}/projects/7/task_def_id/99/peer_progress`).flush({
      task_definition_id: 99,
      unit_id: 1,
      target_grade: 2,
      submitted_percentage: 60,
      completed_percentage: 10,
      distribution_available: false,
      status_distribution: null,
      is_user_enabled: true,
      is_suppressed: false,
      is_stale: false,
      is_feature_enabled: true,
      last_updated_at: '2026-08-23T00:00:00Z',
      unavailable_message: '',
      unavailable_reason: 'sensitive-internal-reason',
      distribution_unavailable_reason: 'sensitive-internal-detail',
    });

    expect(result?.unavailableReason).toBeNull();
    expect(result?.distributionUnavailableReason).toBeNull();
  });

  it.each([
    ['not finite', Number.NaN, Number.POSITIVE_INFINITY],
    ['negative', -10, -20],
    ['over 100', 110, 120],
    ['not quantised', 15, 25],
  ])(
    'fails malformed compact percentages closed when they are %s',
    (_label, submitted, completed) => {
      let result: PeerProgressIndicator | undefined;

      service.getIndicator(7, 99).subscribe((value) => {
        result = value;
      });

      httpMock.expectOne(`${API_URL}/projects/7/task_def_id/99/peer_progress`).flush({
        task_definition_id: 99,
        unit_id: 1,
        target_grade: 2,
        submitted_percentage: submitted,
        completed_percentage: completed,
        distribution_available: false,
        status_distribution: null,
        is_user_enabled: true,
        is_suppressed: false,
        is_stale: false,
        is_feature_enabled: true,
        last_updated_at: '2026-08-23T00:00:00Z',
        unavailable_message: '',
      });

      expect(result?.submittedPercentage).toBeNull();
      expect(result?.completedPercentage).toBeNull();
    },
  );

  it('cancels the live HTTP request when the caller unsubscribes', () => {
    const subscription = service.getIndicator(7, 99).subscribe();
    const request = httpMock.expectOne(`${API_URL}/projects/7/task_def_id/99/peer_progress`);

    subscription.unsubscribe();

    expect(request.cancelled).toBe(true);
  });

  it('masks task peer comparison without calling the API while local demo mode is off', () => {
    demoMode.shouldMaskApiData = true;
    let result: PeerProgressIndicator | undefined;

    service.getIndicator(7, 99).subscribe((value) => {
      result = value;
    });

    httpMock.expectNone(`${API_URL}/projects/7/task_def_id/99/peer_progress`);
    expect(result).toMatchObject({
      taskDefinitionId: 99,
      submittedPercentage: null,
      isFeatureEnabled: false,
      unavailableMessage: 'Enable demo mode to show live peer comparison data.',
    });
  });

  it('keeps the genuine API path when masking is unavailable in production', () => {
    demoMode.shouldMaskApiData = false;
    service.getIndicator(7, 99).subscribe();

    httpMock.expectOne(`${API_URL}/projects/7/task_def_id/99/peer_progress`).flush({
      task_definition_id: 99,
      unit_id: 1,
      target_grade: 2,
      submitted_percentage: 40,
      is_suppressed: false,
      is_stale: false,
      is_feature_enabled: true,
      last_updated_at: '2026-08-23T00:00:00Z',
      unavailable_message: '',
    });
  });

  describe('getDemoUnitSummary', () => {
    it('should keep the student and cohort percentages separate for a normal response', () => {
      service.getDemoUnitSummary(10, 2, 30, 'normal').subscribe((result) => {
        expect(result.studentPercentage).toBe(30);
        expect(result.submittedPercentage).toBe(NORMAL_STATE.submittedPercentage);
        expect(result.isSuppressed).toBe(NORMAL_STATE.isSuppressed);

        expect(result.unitId).toBe(10);
        expect(result.targetGrade).toBe(2);
      });
    });

    it('should not expose a task definition id -- a unit summary is not task-scoped', () => {
      service.getDemoUnitSummary(10, 2, 30, 'normal').subscribe((result) => {
        expect((result as unknown as {taskDefinitionId?: number}).taskDefinitionId).toBeUndefined();
      });
    });

    it('should return suppressed state with the safe message and no cohort percentage', () => {
      service.getDemoUnitSummary(30, 0, 30, 'suppressed').subscribe((result) => {
        expect(result.submittedPercentage).toBe(SUPPRESSED_STATE.submittedPercentage);
        expect(result.isSuppressed).toBe(true);
        expect(result.unavailableMessage).toBe(SUPPRESSED_STATE.unavailableMessage);
        expect(result.studentPercentage).toBe(30);
      });
    });

    it('should return disabled state when the unit has PPI turned off', () => {
      service.getDemoUnitSummary(60, 1, 30, 'disabled').subscribe((result) => {
        expect(result.isFeatureEnabled).toBe(false);
        expect(result.unavailableMessage).toBe(DISABLED_STATE.unavailableMessage);
      });
    });

    it('should preserve a null studentPercentage rather than substituting a default', () => {
      service.getDemoUnitSummary(10, 2, null, 'normal').subscribe((result) => {
        expect(result.studentPercentage).toBeNull();
      });
    });
  });
});
