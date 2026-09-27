import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Router} from '@angular/router';
import {Subject} from 'rxjs';
import {AppLifecycleService, MediaPauseEvent} from '../../services/app-lifecycle.service';
import {AudioPlaybackCoordinatorService} from '../../services/audio-playback-coordinator.service';
import {MediaRecorderService} from '../../services/recorder-service';
import {BaseAudioRecorderComponent} from './base-audio-recorder';

class TestAudioRecorder extends BaseAudioRecorderComponent {
  isSending = false;
  canvas: HTMLCanvasElement;
  canvasCtx: CanvasRenderingContext2D;

  constructor(
    recorder: MediaRecorderService,
    coordinator: AudioPlaybackCoordinatorService,
    lifecycle: AppLifecycleService,
  ) {
    super(recorder, coordinator, lifecycle);
  }

  setup(
    audio: HTMLAudioElement,
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
  ): void {
    this.init();
    this.canvas = canvas;
    this.canvasCtx = context;
    this.attachAudio(audio);
  }

  protected sendRecording(): void {}
}

describe('BaseAudioRecorderComponent', () => {
  let originalCreateObjectURL: PropertyDescriptor | undefined;
  let originalRevokeObjectURL: PropertyDescriptor | undefined;
  let originalRequestAnimationFrame: PropertyDescriptor | undefined;
  let originalCancelAnimationFrame: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(
      globalThis,
      'requestAnimationFrame',
    );
    originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(
      globalThis,
      'cancelAnimationFrame',
    );
  });

  afterEach(() => {
    restoreProperty(URL, 'createObjectURL', originalCreateObjectURL);
    restoreProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
    restoreProperty(globalThis, 'requestAnimationFrame', originalRequestAnimationFrame);
    restoreProperty(globalThis, 'cancelAnimationFrame', originalCancelAnimationFrame);
  });

  it('shows a recoverable permission-denied state instead of pretending to record', async () => {
    const recorder = fakeRecorder();
    const permissionError = new DOMException('denied', 'NotAllowedError');
    recorder.startRecording.mockRejectedValue(permissionError);
    const {component} = setupComponent(recorder);

    component.recordingToggle();
    await flushPromises();

    expect(component.isRequestingPermission).toBe(false);
    expect(component.isRecording).toBe(false);
    expect(component.recordingError).toContain('permission was denied');
  });

  it('accepts a valid very short clip and revokes its preview URL on teardown', () => {
    const recorder = fakeRecorder();
    const createObjectURL = vi.fn(() => 'blob:short-preview');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {configurable: true, value: createObjectURL});
    Object.defineProperty(URL, 'revokeObjectURL', {configurable: true, value: revokeObjectURL});
    const {component, unregister} = setupComponent(recorder);

    recorder.em.dispatchEvent(
      new CustomEvent('recording', {
        detail: {recording: {blob: new Blob(['x'], {type: 'audio/webm'})}},
      }),
    );

    expect(component.recordingAvailable).toBe(true);
    expect(component.recordingError).toBeNull();
    component.ngOnDestroy();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:short-preview');
    expect(recorder.dispose).toHaveBeenCalledOnce();
    expect(unregister).toHaveBeenCalledOnce();
  });

  it('cancels its animation frame and stops recording on a lifecycle pause', async () => {
    const recorder = fakeRecorder();
    recorder.startRecording.mockImplementation(async () => {
      recorder.state = 'recording';
    });
    const requestAnimationFrame = vi.fn(() => 77);
    const cancelAnimationFrame = vi.fn();
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      value: requestAnimationFrame,
    });
    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
      configurable: true,
      value: cancelAnimationFrame,
    });
    const {component, pauseEvents} = setupComponent(recorder);

    component.recordingToggle();
    await flushPromises();
    expect(component.isRecording).toBe(true);
    expect(requestAnimationFrame).toHaveBeenCalled();

    pauseEvents.next({reason: 'app-hidden', occurredAt: Date.now()});
    expect(recorder.stopRecording).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(77);
    expect(component.isRecording).toBe(false);
  });

  describe('with the app lifecycle service', () => {
    let lifecycle: AppLifecycleService;
    let visibilityState: DocumentVisibilityState;
    let originalVisibilityState: PropertyDescriptor | undefined;

    beforeEach(() => {
      visibilityState = 'visible';
      originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => visibilityState,
      });
      Object.defineProperty(globalThis, 'requestAnimationFrame', {
        configurable: true,
        value: vi.fn(() => 1),
      });
      Object.defineProperty(globalThis, 'cancelAnimationFrame', {
        configurable: true,
        value: vi.fn(),
      });
      lifecycle = new AppLifecycleService(document, {
        events: new Subject<unknown>().asObservable(),
      } as unknown as Router);
      lifecycle.start();
    });

    afterEach(() => {
      lifecycle.ngOnDestroy();
      restoreProperty(document, 'visibilityState', originalVisibilityState);
    });

    it('keeps recording through a window blur and stops once the page is hidden', async () => {
      const recorder = fakeRecorder();
      recorder.startRecording.mockImplementation(async () => {
        recorder.state = 'recording';
      });
      const component = setupComponentWith(recorder, lifecycle);

      component.recordingToggle();
      await flushPromises();
      expect(component.isRecording).toBe(true);

      window.dispatchEvent(new Event('blur'));

      expect(recorder.stopRecording).not.toHaveBeenCalled();
      expect(component.isRecording).toBe(true);

      visibilityState = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));

      expect(recorder.stopRecording).toHaveBeenCalledOnce();
      expect(component.isRecording).toBe(false);
    });

    it('does not cancel a pending microphone permission request when the prompt takes focus', async () => {
      const recorder = fakeRecorder();
      let grantPermission: () => void = () => undefined;
      recorder.startRecording.mockImplementation(() => {
        recorder.state = 'requesting';
        return new Promise<void>((resolve) => {
          grantPermission = () => {
            if (recorder.state === 'requesting') {
              recorder.state = 'recording';
            }
            resolve();
          };
        });
      });
      recorder.cancelRecording.mockImplementation(() => {
        recorder.state = 'inactive';
      });
      const component = setupComponentWith(recorder, lifecycle);

      component.recordingToggle();
      expect(component.isRequestingPermission).toBe(true);

      window.dispatchEvent(new Event('blur'));
      grantPermission();
      await flushPromises();

      expect(recorder.cancelRecording).not.toHaveBeenCalled();
      expect(component.isRecording).toBe(true);
      expect(component.recordingError).toBeNull();
    });
  });
});

function fakeRecorder() {
  return {
    state: 'inactive',
    config: {stopTracksAndCloseCtxWhenFinished: true, createAnalyserNode: true},
    em: document.createDocumentFragment(),
    analyserNode: {
      fftSize: 2048,
      getByteTimeDomainData: vi.fn((samples: Uint8Array) => samples.fill(144)),
    },
    startRecording: vi.fn(() => Promise.resolve()),
    stopRecording: vi.fn(),
    cancelRecording: vi.fn(),
    processChunks: vi.fn(),
    dispose: vi.fn(),
  } as unknown as MediaRecorderService & {
    startRecording: ReturnType<typeof vi.fn>;
    stopRecording: ReturnType<typeof vi.fn>;
    cancelRecording: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    state: 'inactive' | 'requesting' | 'recording';
  };
}

function setupComponent(recorder: ReturnType<typeof fakeRecorder>) {
  const pauseEvents: Subject<MediaPauseEvent> = new Subject();
  const unregister = vi.fn();
  const lifecycle = {
    registerMedia: vi.fn(() => unregister),
    mediaPauseSubject: pauseEvents,
  } as unknown as AppLifecycleService;
  const component = setupComponentWith(recorder, lifecycle);
  return {component, pauseEvents, unregister};
}

function setupComponentWith(
  recorder: ReturnType<typeof fakeRecorder>,
  lifecycle: AppLifecycleService,
): TestAudioRecorder {
  const component = new TestAudioRecorder(
    recorder,
    new AudioPlaybackCoordinatorService(),
    lifecycle,
  );
  const audio = document.createElement('audio');
  audio.pause = vi.fn();
  audio.load = vi.fn();
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', {configurable: true, value: 200});
  Object.defineProperty(canvas, 'clientHeight', {configurable: true, value: 24});
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
  component.setup(audio, canvas, context);
  return component;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function restoreProperty(
  target: object,
  property: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
  } else {
    delete (target as Record<PropertyKey, unknown>)[property];
  }
}
