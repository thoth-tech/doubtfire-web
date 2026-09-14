import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AudioPlayerComponent} from './audio-player.component';

// SJ-07: pausing an audio feedback comment must not rewind it to the start.
describe('AudioPlayerComponent', () => {
  let component: AudioPlayerComponent;

  beforeEach(() => {
    const fileDownloader = {releaseBlob: vi.fn()} as never;
    const alerts = {error: vi.fn()} as never;
    component = new AudioPlayerComponent(fileDownloader, alerts);
    component.audio = {pause: vi.fn(), currentTime: 12} as never;
  });

  it('pause() stops playback without rewinding to the start', () => {
    component.isPlaying = true;

    component.pause();

    expect(component.audio.pause).toHaveBeenCalledOnce();
    expect(component.audio.currentTime).toBe(12);
    expect(component.isPlaying).toBe(false);
  });

  it('stop() rewinds to the start', () => {
    component.isPlaying = true;

    component.stop();

    expect(component.audio.pause).toHaveBeenCalledOnce();
    expect(component.audio.currentTime).toBe(0);
    expect(component.isPlaying).toBe(false);
  });
});
