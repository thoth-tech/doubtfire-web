import {beforeEach, describe, expect, it, vi} from 'vitest';
import {HttpResponse} from '@angular/common/http';
import {Subject} from 'rxjs';
import {FileDownloaderService} from '../file-downloader/file-downloader.service';
import {AlertService} from '../services/alert.service';
import {AppLifecycleService, MediaPauseEvent} from '../services/app-lifecycle.service';
import {AudioPlaybackCoordinatorService} from '../services/audio-playback-coordinator.service';
import {AudioWaveformService} from '../services/audio-waveform.service';
import {AudioPlayerComponent} from './audio-player.component';

describe('AudioPlayerComponent', () => {
  let coordinator: AudioPlaybackCoordinatorService;

  beforeEach(() => {
    coordinator = new AudioPlaybackCoordinatorService();
  });

  it('supports finite seeking, keyboard seeking, end reset, and replay', async () => {
    const {component, play} = createPlayer(coordinator);
    component.setSrc('blob:short-valid-audio');
    setProgressWidth(component, 100);

    component.seek({offsetX: 50} as MouseEvent);
    expect(component.audio.currentTime).toBe(5);

    const preventDefault = vi.fn();
    component.seekWithKeyboard({key: 'ArrowRight', preventDefault} as unknown as KeyboardEvent);
    expect(component.audio.currentTime).toBe(5.5);
    expect(preventDefault).toHaveBeenCalledOnce();

    component.play();
    await flushPromises();
    expect(component.isPlaying).toBe(true);
    component.audio.onended(new Event('ended'));
    expect(component.audio.currentTime).toBe(0);
    expect(component.audioProgress).toBe(0);

    component.play();
    await flushPromises();
    expect(play).toHaveBeenCalledTimes(2);
    expect(component.isPlaying).toBe(true);
  });

  it('pauses without rewinding the current playback position', async () => {
    const {component} = createPlayer(coordinator);
    component.setSrc('blob:pause-position');
    component.audio.currentTime = 6;

    component.play();
    await flushPromises();
    component.pause();

    expect(component.audio.currentTime).toBe(6);
    expect(component.isPlaying).toBe(false);
  });

  it('rewinds only when playback is explicitly stopped', () => {
    const {component} = createPlayer(coordinator);
    component.setSrc('blob:stop-position');
    component.audio.currentTime = 6;

    component.stop();

    expect(component.audio.currentTime).toBe(0);
    expect(component.audioProgress).toBe(0);
  });

  it('allows only one audio message to remain playing', async () => {
    const first = createPlayer(coordinator);
    const second = createPlayer(coordinator);
    first.component.setSrc('blob:first');
    second.component.setSrc('blob:second');
    first.pause.mockClear();

    first.component.play();
    await flushPromises();
    second.component.play();
    await flushPromises();

    expect(first.pause).toHaveBeenCalledOnce();
    expect(first.component.isPlaying).toBe(false);
    expect(second.component.isPlaying).toBe(true);
  });

  it('enters a recoverable error state for corrupt playback or waveform data', async () => {
    const {component, alerts, waveform} = createPlayer(coordinator);
    waveform.decodePeaks.mockRejectedValueOnce(new DOMException('bad audio', 'EncodingError'));
    component.setSrc('blob:corrupt');
    await flushPromises();

    expect(component.waveformUnavailable).toBe(true);
    component.audio.onerror(new Event('error'));
    expect(component.audioError).toContain('could not be played');
    expect(component.isPlaying).toBe(false);
    expect(alerts.error).toHaveBeenCalled();
  });

  it('pauses on a lifecycle event and does not auto-resume', async () => {
    const {component, pauseEvents, play, unregister} = createPlayer(coordinator);
    component.setSrc('blob:lifecycle');
    component.play();
    await flushPromises();

    pauseEvents.next({reason: 'app-hidden', occurredAt: Date.now()});

    expect(component.isPlaying).toBe(false);
    expect(play).toHaveBeenCalledOnce();
    component.ngOnDestroy();
    expect(unregister).toHaveBeenCalledOnce();
  });

  it('drops a play queued behind a download when a lifecycle pause arrives', async () => {
    const {component, pauseEvents, play, fileDownloader} = createPlayer(coordinator);
    component.audioSrc = {src: '/audio/slow-download'};

    component.play();
    expect(fileDownloader.downloadBlob).toHaveBeenCalledOnce();
    const onDownloaded = fileDownloader.downloadBlob.mock.calls[0][1] as (
      blobUrl: string,
      response: HttpResponse<Blob>,
    ) => void;

    pauseEvents.next({reason: 'app-hidden', occurredAt: Date.now()});
    onDownloaded('blob:late-audio', {} as HttpResponse<Blob>);
    await flushPromises();

    expect(play).not.toHaveBeenCalled();
    expect(component.isPlaying).toBe(false);

    component.play();
    await flushPromises();
    expect(play).toHaveBeenCalledOnce();
  });

  it('releases object URLs on replacement and destruction', () => {
    const {component, fileDownloader} = createPlayer(coordinator);
    component.setSrc('blob:first');
    component.setSrc('blob:second');
    component.ngOnDestroy();

    expect(fileDownloader.releaseBlob).toHaveBeenCalledWith('blob:first');
    expect(fileDownloader.releaseBlob).toHaveBeenCalledWith('blob:second');
  });
});

function createPlayer(coordinator: AudioPlaybackCoordinatorService) {
  const pauseEvents: Subject<MediaPauseEvent> = new Subject();
  const unregister = vi.fn();
  const fileDownloader = {
    releaseBlob: vi.fn(),
    downloadBlob: vi.fn(),
  };
  const alerts = {error: vi.fn()};
  const waveform = {decodePeaks: vi.fn(() => Promise.resolve([0.2, 0.5, 1]))};
  const component = new AudioPlayerComponent(
    fileDownloader as unknown as FileDownloaderService,
    alerts as unknown as AlertService,
    {
      registerMedia: vi.fn(() => unregister),
      mediaPauseSubject: pauseEvents,
    } as unknown as AppLifecycleService,
    coordinator,
    waveform as unknown as AudioWaveformService,
  );

  let paused = true;
  let currentTime = 0;
  Object.defineProperty(component.audio, 'paused', {configurable: true, get: () => paused});
  Object.defineProperty(component.audio, 'duration', {configurable: true, get: () => 10});
  Object.defineProperty(component.audio, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => (currentTime = value),
  });
  const play = vi.fn(() => {
    paused = false;
    return Promise.resolve();
  });
  const pause = vi.fn(() => (paused = true));
  component.audio.play = play;
  component.audio.pause = pause;
  component.audio.load = vi.fn();

  return {component, play, pause, pauseEvents, unregister, fileDownloader, alerts, waveform};
}

function setProgressWidth(component: AudioPlayerComponent, width: number): void {
  (component as unknown as {progressBar: {nativeElement: HTMLElement}}).progressBar = {
    nativeElement: {
      getBoundingClientRect: () => ({width}),
    } as unknown as HTMLElement,
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
