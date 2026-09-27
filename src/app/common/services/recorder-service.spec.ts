import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {MediaRecorderService} from './recorder-service';

interface FakeAudioContextRecord {
  close: ReturnType<typeof vi.fn>;
}

describe('MediaRecorderService', () => {
  let originalAudioContext: PropertyDescriptor | undefined;
  let originalMediaRecorder: PropertyDescriptor | undefined;
  let originalMediaDevices: PropertyDescriptor | undefined;
  let contexts: FakeAudioContextRecord[];

  beforeEach(() => {
    originalAudioContext = Object.getOwnPropertyDescriptor(window, 'AudioContext');
    originalMediaRecorder = Object.getOwnPropertyDescriptor(window, 'MediaRecorder');
    originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    contexts = [];

    class FakeAudioContext {
      currentTime = 0;
      sampleRate = 44_100;
      destination = fakeNode();
      close = vi.fn(() => Promise.resolve());
      createGain = vi.fn(() => ({...fakeNode(), gain: {setValueAtTime: vi.fn()}}));
      createAnalyser = vi.fn(() => ({
        ...fakeNode(),
        fftSize: 2048,
        getByteTimeDomainData: vi.fn(),
      }));
      createDynamicsCompressor = vi.fn(() => fakeNode());
      createScriptProcessor = vi.fn(() => ({...fakeNode(), onaudioprocess: null}));
      createMediaStreamDestination = vi.fn(() => ({...fakeNode(), stream: {}}));
      createMediaStreamSource = vi.fn(() => ({...fakeNode(), context: this}));

      constructor() {
        contexts.push(this);
      }
    }

    class FakeMediaRecorder extends EventTarget {
      state: RecordingState = 'inactive';
      constructor(_stream: MediaStream, _options: MediaRecorderOptions) {
        super();
      }
      start(): void {
        this.state = 'recording';
      }
      stop(): void {
        this.state = 'inactive';
        const event = new Event('dataavailable');
        Object.defineProperty(event, 'data', {
          value: new Blob(['x'], {type: 'audio/webm'}),
        });
        this.dispatchEvent(event);
      }
      requestData(): void {}
    }

    Object.defineProperty(window, 'AudioContext', {configurable: true, value: FakeAudioContext});
    Object.defineProperty(window, 'MediaRecorder', {configurable: true, value: FakeMediaRecorder});
  });

  afterEach(() => {
    restoreProperty(window, 'AudioContext', originalAudioContext);
    restoreProperty(window, 'MediaRecorder', originalMediaRecorder);
    restoreProperty(navigator, 'mediaDevices', originalMediaDevices);
  });

  it('reports permission denial and closes the graph it created before the prompt', async () => {
    const permissionError = new DOMException('denied', 'NotAllowedError');
    setGetUserMedia(vi.fn(() => Promise.reject(permissionError)));
    const service = new MediaRecorderService();
    const failures: unknown[] = [];
    service.em.addEventListener('error', (event) =>
      failures.push((event as CustomEvent<{error: unknown}>).detail.error),
    );

    await expect(service.startRecording()).rejects.toBe(permissionError);

    expect(service.state).toBe('inactive');
    expect(failures).toEqual([permissionError]);
    expect(contexts[0].close).toHaveBeenCalledOnce();
    expect(service.audioCtx).toBeNull();
    expect(service.analyserNode).toBeNull();
  });

  it('stops a late microphone stream after cancellation during the permission prompt', async () => {
    let resolvePermission!: (stream: MediaStream) => void;
    const permission: Promise<MediaStream> = new Promise(
      (resolve) => (resolvePermission = resolve),
    );
    setGetUserMedia(vi.fn(() => permission));
    const service = new MediaRecorderService();
    const start = service.startRecording();
    const stopTrack = vi.fn();

    service.cancelRecording();
    resolvePermission({getTracks: () => [{stop: stopTrack}]} as unknown as MediaStream);
    await start;

    expect(stopTrack).toHaveBeenCalledOnce();
    expect(service.state).toBe('inactive');
    expect(contexts[0].close).toHaveBeenCalledOnce();
  });

  it('emits a short recording and releases its track and audio context on stop', async () => {
    const stopTrack = vi.fn();
    setGetUserMedia(
      vi.fn(() =>
        Promise.resolve({getTracks: () => [{stop: stopTrack}]} as unknown as MediaStream),
      ),
    );
    const service = new MediaRecorderService();
    const recordings: Blob[] = [];
    service.em.addEventListener('recording', (event) =>
      recordings.push((event as CustomEvent<{recording: {blob: Blob}}>).detail.recording.blob),
    );

    await service.startRecording();
    service.stopRecording();

    expect(recordings).toHaveLength(1);
    expect(recordings[0].size).toBe(1);
    expect(service.state).toBe('inactive');
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(contexts[0].close).toHaveBeenCalledOnce();
  });
});

function fakeNode() {
  return {connect: vi.fn(), disconnect: vi.fn()};
}

function setGetUserMedia(getUserMedia: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {getUserMedia},
  });
}

function restoreProperty(target: object, property: string, descriptor?: PropertyDescriptor): void {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
  } else {
    delete (target as Record<string, unknown>)[property];
  }
}
