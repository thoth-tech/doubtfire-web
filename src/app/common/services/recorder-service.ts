import {Injectable} from '@angular/core';

export type RecorderState = 'inactive' | 'requesting' | 'recording' | 'stopping';

interface RecorderConfig {
  broadcastAudioProcessEvents: boolean;
  createAnalyserNode: boolean;
  createDynamicsCompressorNode: boolean;
  forceScriptProcessor: boolean;
  manualEncoderId: 'wav' | 'ogg';
  micGain: number;
  processorBufferSize: number;
  stopTracksAndCloseCtxWhenFinished: boolean;
  userMediaConstraints: MediaStreamConstraints;
  audioBitsPerSecond: number;
}

export interface RecorderFailureEvent extends Event {
  detail: {error: unknown};
}

@Injectable()
export class MediaRecorderService {
  readonly em: DocumentFragment = document.createDocumentFragment();
  state: RecorderState = 'inactive';
  audioCtx: AudioContext | null = null;
  chunks: BlobPart[] = [];
  chunkType: string | null = null;
  usingMediaRecorder: boolean;
  encoderMimeType?: string;
  config: RecorderConfig;

  micGainNode: GainNode | null = null;
  outputGainNode: GainNode | null = null;
  dynamicsCompressorNode: DynamicsCompressorNode | null = null;
  analyserNode: AnalyserNode | null = null;
  processorNode: ScriptProcessorNode | null = null;
  destinationNode: MediaStreamAudioDestinationNode | AudioDestinationNode | null = null;
  encoderWorker: Worker | null = null;
  micAudioStream: MediaStream | null = null;
  inputStreamNode: MediaStreamAudioSourceNode | null = null;
  mediaRecorder: MediaRecorder | null = null;
  onGraphSetupWithInputStream?: (inputStream: MediaStreamAudioSourceNode) => void;

  private requestGeneration = 0;
  private readonly mediaRecorderDataListener = (event: BlobEvent) => this.onDataAvailable(event);
  private readonly mediaRecorderErrorListener = (event: Event) => this.onError(event);
  private readonly workerMessageListener = (event: MessageEvent<BlobPart[] | Blob>) => {
    const dataEvent = new Event('dataavailable') as Event & {data: Blob};
    dataEvent.data =
      this.config.manualEncoderId === 'ogg'
        ? (event.data as Blob)
        : new Blob(event.data as BlobPart[], {type: this.encoderMimeType});
    this.onDataAvailable(dataEvent);
  };

  constructor() {
    this.usingMediaRecorder = Boolean(window.MediaRecorder);
    if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
      this.usingMediaRecorder = false;
    }

    this.config = {
      broadcastAudioProcessEvents: false,
      createAnalyserNode: true,
      createDynamicsCompressorNode: false,
      forceScriptProcessor: false,
      manualEncoderId: 'wav',
      micGain: 1.0,
      processorBufferSize: 2048,
      stopTracksAndCloseCtxWhenFinished: true,
      userMediaConstraints: {audio: true},
      audioBitsPerSecond: 128000,
    };
  }

  async startRecording(): Promise<void> {
    if (this.state !== 'inactive') {
      return;
    }
    if (!navigator?.mediaDevices?.getUserMedia) {
      const error = new Error('Audio recording is unavailable in this browser.');
      this.dispatchError(error);
      throw error;
    }

    this.cleanupGraph();
    this.state = 'requesting';
    const requestGeneration = ++this.requestGeneration;

    try {
      this.setupAudioGraph();
      const stream = await navigator.mediaDevices.getUserMedia(this.config.userMediaConstraints);
      if (requestGeneration !== this.requestGeneration || this.state !== 'requesting') {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.startRecordingWithStream(stream);
    } catch (error) {
      if (requestGeneration === this.requestGeneration) {
        this.state = 'inactive';
        this.dispatchError(error);
        this.cleanupGraph();
      }
      throw error;
    }
  }

  setMicGain(newGain: number): void {
    this.config.micGain = newGain;
    if (this.audioCtx && this.micGainNode) {
      this.micGainNode.gain.setValueAtTime(newGain, this.audioCtx.currentTime);
    }
  }

  processChunks(): void {
    if (this.state !== 'recording') {
      return;
    }
    if (this.usingMediaRecorder) {
      this.mediaRecorder?.requestData();
    } else {
      this.encoderWorker?.postMessage(['dump', this.audioCtx?.sampleRate]);
    }
  }

  stopRecording(): void {
    if (this.state === 'requesting') {
      this.cancelRecording();
      return;
    }
    if (this.state !== 'recording') {
      return;
    }

    this.state = 'stopping';
    if (this.usingMediaRecorder) {
      try {
        this.mediaRecorder?.stop();
      } catch (error) {
        this.onError(error as Event);
      }
    } else {
      this.encoderWorker?.postMessage(['dump', this.audioCtx?.sampleRate]);
    }
  }

  /** Cancel without producing a recording; safe during permission prompts and teardown. */
  cancelRecording(): void {
    this.requestGeneration++;
    this.state = 'inactive';
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.removeEventListener('dataavailable', this.mediaRecorderDataListener);
      try {
        this.mediaRecorder.stop();
      } catch {
        // The graph cleanup below is the authoritative cancellation path.
      }
    }
    this.chunks = [];
    this.cleanupGraph();
  }

  dispose(): void {
    this.cancelRecording();
  }

  private setupAudioGraph(): void {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioContextConstructor) {
      throw new Error('Web Audio is unavailable in this browser.');
    }

    this.audioCtx = new AudioContextConstructor();
    this.micGainNode = this.audioCtx.createGain();
    this.outputGainNode = this.audioCtx.createGain();
    this.dynamicsCompressorNode = this.config.createDynamicsCompressorNode
      ? this.audioCtx.createDynamicsCompressor()
      : null;
    this.analyserNode = this.config.createAnalyserNode ? this.audioCtx.createAnalyser() : null;

    if (
      this.config.forceScriptProcessor ||
      this.config.broadcastAudioProcessEvents ||
      !this.usingMediaRecorder
    ) {
      this.processorNode = this.audioCtx.createScriptProcessor(
        this.config.processorBufferSize,
        1,
        1,
      );
    }

    this.destinationNode = this.audioCtx.createMediaStreamDestination
      ? this.audioCtx.createMediaStreamDestination()
      : this.audioCtx.destination;

    if (!this.usingMediaRecorder) {
      this.encoderWorker = new Worker('/assets/wav-worker.js');
      this.encoderMimeType = 'audio/wav';
      this.encoderWorker.addEventListener('message', this.workerMessageListener);
    }
  }

  private startRecordingWithStream(stream: MediaStream): void {
    if (!this.audioCtx || !this.micGainNode || !this.outputGainNode || !this.destinationNode) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('The audio recording graph could not be created.');
    }

    this.micAudioStream = stream;
    this.inputStreamNode = this.audioCtx.createMediaStreamSource(stream);
    this.audioCtx = this.inputStreamNode.context as AudioContext;
    this.onGraphSetupWithInputStream?.(this.inputStreamNode);

    this.inputStreamNode.connect(this.micGainNode);
    this.micGainNode.gain.setValueAtTime(this.config.micGain, this.audioCtx.currentTime);

    let nextNode: AudioNode = this.micGainNode;
    if (this.dynamicsCompressorNode) {
      this.micGainNode.connect(this.dynamicsCompressorNode);
      nextNode = this.dynamicsCompressorNode;
    }
    if (this.processorNode) {
      nextNode.connect(this.processorNode);
      this.processorNode.connect(this.outputGainNode);
      this.processorNode.onaudioprocess = (event: AudioProcessingEvent) =>
        this.onAudioProcess(event);
    } else {
      nextNode.connect(this.outputGainNode);
    }
    if (this.analyserNode) {
      nextNode.connect(this.analyserNode);
    }
    this.outputGainNode.connect(this.destinationNode);

    this.chunks = [];
    this.state = 'recording';
    if (this.usingMediaRecorder) {
      const destination = this.destinationNode as MediaStreamAudioDestinationNode;
      this.mediaRecorder = new MediaRecorder(destination.stream, {
        audioBitsPerSecond: this.config.audioBitsPerSecond,
      });
      this.mediaRecorder.addEventListener('dataavailable', this.mediaRecorderDataListener);
      this.mediaRecorder.addEventListener('error', this.mediaRecorderErrorListener);
      this.mediaRecorder.start();
    } else {
      this.outputGainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
    }
  }

  private onAudioProcess(event: AudioProcessingEvent): void {
    if (this.config.broadcastAudioProcessEvents) {
      this.em.dispatchEvent(
        new CustomEvent('onaudioprocess', {
          detail: {inputBuffer: event.inputBuffer, outputBuffer: event.outputBuffer},
        }),
      );
    }
    if (!this.usingMediaRecorder && this.state === 'recording' && this.encoderWorker) {
      const samples = this.config.broadcastAudioProcessEvents
        ? event.outputBuffer.getChannelData(0)
        : event.inputBuffer.getChannelData(0);
      this.encoderWorker.postMessage(['encode', samples]);
    }
  }

  private onDataAvailable(event: BlobEvent | (Event & {data: Blob})): void {
    if (event.data?.size > 0) {
      this.chunks.push(event.data);
      this.chunkType = event.data.type;
    }

    // requestData() may emit while recording; only a stop produces the final clip.
    if (this.state === 'recording') {
      return;
    }

    const blob = new Blob(this.chunks, {type: this.chunkType || event.data?.type || ''});
    this.state = 'inactive';
    this.em.dispatchEvent(
      new CustomEvent('recording', {
        detail: {
          recording: {
            ts: Date.now(),
            mimeType: blob.type,
            size: blob.size,
            blob,
          },
        },
      }),
    );
    this.chunks = [];
    this.cleanupGraph();
  }

  private onError(event: Event): void {
    const error = (event as Event & {error?: unknown}).error || event;
    this.state = 'inactive';
    this.dispatchError(error);
    this.chunks = [];
    this.cleanupGraph();
  }

  private dispatchError(error: unknown): void {
    this.em.dispatchEvent(new CustomEvent('error', {detail: {error}}));
  }

  private cleanupGraph(): void {
    this.mediaRecorder?.removeEventListener('dataavailable', this.mediaRecorderDataListener);
    this.mediaRecorder?.removeEventListener('error', this.mediaRecorderErrorListener);
    this.mediaRecorder = null;

    this.destinationNode?.disconnect();
    this.destinationNode = null;
    this.outputGainNode?.disconnect();
    this.outputGainNode = null;
    this.analyserNode?.disconnect();
    this.analyserNode = null;
    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      this.processorNode.disconnect();
    }
    this.processorNode = null;

    if (this.encoderWorker) {
      this.encoderWorker.removeEventListener('message', this.workerMessageListener);
      this.encoderWorker.postMessage(['close']);
      this.encoderWorker.terminate();
      this.encoderWorker = null;
    }

    this.dynamicsCompressorNode?.disconnect();
    this.dynamicsCompressorNode = null;
    this.micGainNode?.disconnect();
    this.micGainNode = null;
    this.inputStreamNode?.disconnect();
    this.inputStreamNode = null;

    if (this.config.stopTracksAndCloseCtxWhenFinished) {
      this.micAudioStream?.getTracks().forEach((track) => track.stop());
      this.micAudioStream = null;
      void this.audioCtx?.close().catch(() => undefined);
      this.audioCtx = null;
    }
    this.chunkType = null;
  }
}
