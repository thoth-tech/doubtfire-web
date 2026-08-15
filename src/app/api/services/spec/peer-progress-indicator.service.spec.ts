import {beforeEach, describe, expect, it} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {
  DISABLED_STATE,
  NORMAL_STATE,
  STALE_STATE,
  SUPPRESSED_STATE,
  UNAVAILABLE_STATE,
  ZERO_PERCENT_STATE,
} from '../mock/peer-progress-indicator.mock';
import {PeerProgressIndicatorService} from '../peer-progress-indicator.service';

describe('PeerProgressIndicatorService', () => {
  let service: PeerProgressIndicatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PeerProgressIndicatorService],
    });

    service = TestBed.inject(PeerProgressIndicatorService);
  });

  it('should return normal state', () => {
    service.getIndicator(1, 10, 2, 'normal').subscribe((result) => {
      expect(result.submittedPercentage).toBe(NORMAL_STATE.submittedPercentage);
      expect(result.isSuppressed).toBe(NORMAL_STATE.isSuppressed);
      expect(result.isFeatureEnabled).toBe(NORMAL_STATE.isFeatureEnabled);

      // overwritten fields
      expect(result.taskDefinitionId).toBe(1);
      expect(result.unitId).toBe(10);
      expect(result.targetGrade).toBe(2);
    });
  });

  it('should return zero percent state', () => {
    service.getIndicator(2, 20, 1, 'zero').subscribe((result) => {
      expect(result.submittedPercentage).toBe(ZERO_PERCENT_STATE.submittedPercentage);
      expect(result.isSuppressed).toBe(ZERO_PERCENT_STATE.isSuppressed);

      expect(result.taskDefinitionId).toBe(2);
      expect(result.unitId).toBe(20);
      expect(result.targetGrade).toBe(1);
    });
  });

  it('should return suppressed state', () => {
    service.getIndicator(3, 30, 0, 'suppressed').subscribe((result) => {
      expect(result.submittedPercentage).toBe(SUPPRESSED_STATE.submittedPercentage);
      expect(result.isSuppressed).toBe(true);
      expect(result.unavailableMessage).toBe(SUPPRESSED_STATE.unavailableMessage);

      expect(result.taskDefinitionId).toBe(3);
      expect(result.unitId).toBe(30);
      expect(result.targetGrade).toBe(0);
    });
  });

  it('should return unavailable state', () => {
    service.getIndicator(4, 40, 3, 'unavailable').subscribe((result) => {
      expect(result.submittedPercentage).toBe(UNAVAILABLE_STATE.submittedPercentage);
      expect(result.unavailableMessage).toBe(UNAVAILABLE_STATE.unavailableMessage);

      expect(result.taskDefinitionId).toBe(4);
      expect(result.unitId).toBe(40);
      expect(result.targetGrade).toBe(3);
    });
  });

  it('should return stale state', () => {
    service.getIndicator(5, 50, 2, 'stale').subscribe((result) => {
      expect(result.submittedPercentage).toBe(STALE_STATE.submittedPercentage);
      expect(result.isStale).toBe(true);
      expect(result.unavailableMessage).toBe(STALE_STATE.unavailableMessage);

      expect(result.taskDefinitionId).toBe(5);
      expect(result.unitId).toBe(50);
      expect(result.targetGrade).toBe(2);
    });
  });

  it('should return disabled state', () => {
    service.getIndicator(6, 60, 1, 'disabled').subscribe((result) => {
      expect(result.submittedPercentage).toBe(DISABLED_STATE.submittedPercentage);
      expect(result.isFeatureEnabled).toBe(false);
      expect(result.unavailableMessage).toBe(DISABLED_STATE.unavailableMessage);

      expect(result.taskDefinitionId).toBe(6);
      expect(result.unitId).toBe(60);
      expect(result.targetGrade).toBe(1);
    });
  });

  it('should fall back to unavailable state for unknown keys', () => {
    service.getIndicator(99, 99, 0, 'unknown' as 'normal').subscribe((result) => {
      expect(result.unavailableMessage).toBe(UNAVAILABLE_STATE.unavailableMessage);
      expect(result.submittedPercentage).toBeNull();

      expect(result.taskDefinitionId).toBe(99);
      expect(result.unitId).toBe(99);
      expect(result.targetGrade).toBe(0);
    });
  });
});
