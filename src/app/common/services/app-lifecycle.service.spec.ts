import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NavigationStart, Router} from '@angular/router';
import {Subject} from 'rxjs';
import {AppLifecycleService} from './app-lifecycle.service';

describe('AppLifecycleService', () => {
  let service: AppLifecycleService;
  let routerEvents: Subject<unknown>;
  let visibilityState: DocumentVisibilityState;
  let originalVisibilityState: PropertyDescriptor | undefined;

  beforeEach(() => {
    visibilityState = 'visible';
    originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
    routerEvents = new Subject();
    service = new AppLifecycleService(document, {
      events: routerEvents.asObservable(),
    } as unknown as Router);
    service.start();
  });

  afterEach(() => {
    service.ngOnDestroy();
    if (originalVisibilityState) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityState);
    } else {
      delete (document as Document & {visibilityState?: DocumentVisibilityState}).visibilityState;
    }
  });

  function registeredPlayingMedia(): {media: HTMLMediaElement; pause: ReturnType<typeof vi.fn>} {
    const pause = vi.fn();
    const media = {paused: false, pause} as unknown as HTMLMediaElement;
    service.registerMedia(media);
    return {media, pause};
  }

  it('pauses registered media and publishes hidden state when the app is backgrounded', () => {
    const {pause} = registeredPlayingMedia();
    const pauseEvents: string[] = [];
    service.mediaPauseSubject.subscribe((event) => pauseEvents.push(event.reason));

    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));

    expect(service.stateSubject.value).toBe('hidden');
    expect(pause).toHaveBeenCalledOnce();
    expect(pauseEvents).toEqual(['app-hidden']);
  });

  it('pauses media on route change', () => {
    const {pause} = registeredPlayingMedia();

    routerEvents.next(new NavigationStart(1, '/projects/2/dashboard'));

    expect(pause).toHaveBeenCalledOnce();
  });

  it('returns from a 30-second background interval without reload or media auto-resume', async () => {
    vi.useFakeTimers();
    const {pause} = registeredPlayingMedia();

    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(30_000);
    visibilityState = 'visible';
    window.dispatchEvent(new Event('focus'));

    expect(service.stateSubject.value).toBe('active');
    expect(pause).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('ignores a window blur/focus round trip while the page stays visible', () => {
    const {pause} = registeredPlayingMedia();
    const pauseEvents: string[] = [];
    service.mediaPauseSubject.subscribe((event) => pauseEvents.push(event.reason));

    // A file picker, a microphone permission prompt or another window taking focus.
    window.dispatchEvent(new Event('blur'));

    expect(service.stateSubject.value).toBe('active');
    expect(pause).not.toHaveBeenCalled();
    expect(pauseEvents).toEqual([]);

    window.dispatchEvent(new Event('focus'));

    expect(service.stateSubject.value).toBe('active');
    expect(pauseEvents).toEqual([]);
  });

  it('pauses media when the page is hidden for bfcache or unload', () => {
    const {pause} = registeredPlayingMedia();

    window.dispatchEvent(new Event('pagehide'));

    expect(service.stateSubject.value).toBe('hidden');
    expect(pause).toHaveBeenCalledOnce();
  });

  it('pauses media when the browser freezes the page', () => {
    const {pause} = registeredPlayingMedia();
    const pauseEvents: string[] = [];
    service.mediaPauseSubject.subscribe((event) => pauseEvents.push(event.reason));

    document.dispatchEvent(new Event('freeze'));

    expect(service.stateSubject.value).toBe('hidden');
    expect(pause).toHaveBeenCalledOnce();
    expect(pauseEvents).toEqual(['app-hidden']);
  });

  it('stops listening once stopped', () => {
    const {pause} = registeredPlayingMedia();
    service.stop();

    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('freeze'));

    expect(pause).not.toHaveBeenCalled();
  });
});
