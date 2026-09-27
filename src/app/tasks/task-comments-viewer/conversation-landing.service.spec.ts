import {describe, expect, it, vi} from 'vitest';
import {ConversationLandingService} from './conversation-landing.service';

describe('ConversationLandingService', () => {
  const firstConversation = {projectId: 7, taskDefinitionId: 11};
  const secondConversation = {projectId: 7, taskDefinitionId: 12};

  it('keeps a request pending until the matching conversation completes it', () => {
    const service = new ConversationLandingService();
    const request = service.requestLatestMessages(firstConversation);

    expect(service.pendingFor(firstConversation)).toBe(request);
    expect(service.pendingFor(secondConversation)).toBeNull();

    service.complete(request);

    expect(service.pendingFor(firstConversation)).toBeNull();
  });

  it('notifies an already-mounted viewer when a new request arrives', () => {
    const service = new ConversationLandingService();
    const received = vi.fn();
    service.requests$.subscribe(received);

    const request = service.requestLatestMessages(firstConversation);

    expect(received).toHaveBeenCalledWith(request);
  });

  it('retains only the latest unfulfilled navigation intent', () => {
    const service = new ConversationLandingService();
    const earlier = service.requestLatestMessages(firstConversation);
    const latest = service.requestLatestMessages(secondConversation);

    service.complete(earlier);

    expect(service.pendingFor(firstConversation)).toBeNull();
    expect(service.pendingFor(secondConversation)).toBe(latest);
  });

  it('allows a failed navigation to cancel its pending request', () => {
    const service = new ConversationLandingService();
    const request = service.requestLatestMessages(firstConversation);

    service.cancel(request);

    expect(service.pendingFor(firstConversation)).toBeNull();
  });
});
