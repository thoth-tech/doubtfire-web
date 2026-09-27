import {describe, expect, it, vi} from 'vitest';
import {AudioPlaybackCoordinatorService} from './audio-playback-coordinator.service';

describe('AudioPlaybackCoordinatorService', () => {
  it('pauses and deactivates the previous audio item', () => {
    const service = new AudioPlaybackCoordinatorService();
    const firstInterrupted = vi.fn();
    const first = {pause: vi.fn()} as unknown as HTMLAudioElement;
    const second = {pause: vi.fn()} as unknown as HTMLAudioElement;

    service.activate(first, firstInterrupted);
    service.activate(second, vi.fn());

    expect(first.pause).toHaveBeenCalledOnce();
    expect(firstInterrupted).toHaveBeenCalledOnce();
    expect(service.isActive(first)).toBe(false);
    expect(service.isActive(second)).toBe(true);
  });

  it('releases only the currently active item', () => {
    const service = new AudioPlaybackCoordinatorService();
    const first = {pause: vi.fn()} as unknown as HTMLAudioElement;
    const second = {pause: vi.fn()} as unknown as HTMLAudioElement;
    service.activate(first, vi.fn());

    service.release(second);
    expect(service.isActive(first)).toBe(true);

    service.release(first);
    expect(service.isActive(first)).toBe(false);
  });
});
