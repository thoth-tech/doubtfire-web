import {describe, expect, it, vi} from 'vitest';
import {NotificationFeedbackRouteIntentService} from '../notification-feedback-route-intent.service';

describe('NotificationFeedbackRouteIntentService', () => {
  const target = {projectId: 7, taskAbbreviation: '1.1P'};

  it('carries one intent until the matching resolved task consumes it', () => {
    const service = new NotificationFeedbackRouteIntentService();
    const request = service.request(target);

    expect(service.consume({projectId: 7, taskAbbreviation: 'OTHER'})).toBeNull();
    expect(service.consume(target)).toBe(request);
    expect(service.consume(target)).toBeNull();
  });

  it('notifies an already-mounted project when the same feedback route is clicked', () => {
    const service = new NotificationFeedbackRouteIntentService();
    const observed = vi.fn();
    service.requests$.subscribe(observed);

    const request = service.request(target);

    expect(observed).toHaveBeenCalledWith(request);
  });

  it('retains only the latest intent and cannot cancel it with an older request', () => {
    const service = new NotificationFeedbackRouteIntentService();
    const older = service.request(target);
    const latest = service.request({projectId: 8, taskAbbreviation: '2.1P'});

    service.cancel(older);

    expect(service.consume({projectId: 8, taskAbbreviation: '2.1P'})).toBe(latest);
  });

  it('clears account-scoped state on sign out', () => {
    const service = new NotificationFeedbackRouteIntentService();
    service.request(target);

    service.clear();

    expect(service.consume(target)).toBeNull();
  });
});
