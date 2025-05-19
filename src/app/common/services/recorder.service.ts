import { Injectable, NgZone } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

interface RecordingDetail {
  ts: number;
  blobUrl: string;
  mimeType: string;
  size: number;
  blob: Blob;
}

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

@Injectable({ providedIn: 'root' })
export class RecorderService {
  public em = document.createDocumentFragment();
  public state: 'inactive' | 'recording' = 'inactive';

  private audioCtx: AudioContext | null = null;
  private micGainNode: GainNode | null = null;
  private outputGainNode: GainNode | null = null;
  private dynamicsCompressorNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | AudioDestinationNode | null = null;
  private encoderWorker: Worker | null = null;
  private mediaRecorder: MediaRecorder | null = null;

  private micAudioStream: MediaStream | null = null;
  private inputStreamNode: MediaStreamAudioSourceNode | null = null;
  private slicing: any;

  private chunks: Blob[] = [];
  private chunkType: string | null = '';
  private usingMediaRecorder: boolean;
  private encoderMimeType: string = '';
  private config: RecorderConfig;


  public onGraphSetupWithInputStream?: (node: MediaStreamAudioSourceNode) => void;

  constructor(
    private zone: NgZone,
    private sanitizer: DomSanitizer
  ) {
    window.AudioContext = window.AudioContext || (window as any).webkitAudioContext;

    this.usingMediaRecorder = typeof window.MediaRecorder !== 'undefined';
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
      userMediaConstraints: { audio: true },
      audioBitsPerSecond: 128000,
    };
  }

  /**
   * Start the recording process.
   */
  startRecording(): Promise<void> {
    if (this.state !== 'inactive') {
      return Promise.resolve();
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('Missing support for navigator.mediaDevices.getUserMedia');
      return Promise.resolve();
    }

    this.audioCtx = new AudioContext();
    this.micGainNode = this.audioCtx.createGain();
    this.outputGainNode = this.audioCtx.createGain();

    if (this.config.createDynamicsCompressorNode) {
      this.dynamicsCompressorNode = this.audioCtx.createDynamicsCompressor();
    }

    if (this.config.createAnalyserNode) {
      this.analyserNode = this.audioCtx.createAnalyser();
    }

    if (
      this.config.forceScriptProcessor ||
      this.config.broadcastAudioProcessEvents ||
      !this.usingMediaRecorder
    ) {
      this.processorNode = this.audioCtx.createScriptProcessor(
        this.config.processorBufferSize,
        1,
        1
      );
    }

    if ((this.audioCtx as any).createMediaStreamDestination) {
      this.destinationNode = (this.audioCtx as any).createMediaStreamDestination();
    } else {
      this.destinationNode = this.audioCtx.destination;
    }

    if (!this.usingMediaRecorder) {
      this.encoderWorker = new Worker('/assets/wav-worker.js');
      this.encoderMimeType = 'audio/wav';
      this.encoderWorker.addEventListener('message', (e: MessageEvent) => {
        const event = new Event('dataavailable') as BlobEvent;
        const dataBlob =
          this.config.manualEncoderId === 'ogg'
            ? e.data
            : new Blob(e.data, { type: this.encoderMimeType });
        (event as any).data = dataBlob;
        this._onDataAvailable(event);
      });
    }

    return navigator.mediaDevices
      .getUserMedia(this.config.userMediaConstraints)
      .then((stream) => this._startRecordingWithStream(stream))
      .catch(() => {});
  }

  /**
   * Adjust microphone gain mid-recording.
   */
  setMicGain(newGain: number): void {
    this.config.micGain = newGain;
    if (this.audioCtx && this.micGainNode) {
      this.micGainNode.gain.setValueAtTime(newGain, this.audioCtx.currentTime);
    }
  }

  private _startRecordingWithStream(stream: MediaStream): void {
    this.micAudioStream = stream;
    this.inputStreamNode = this.audioCtx!.createMediaStreamSource(stream);
    this.audioCtx = this.inputStreamNode.context;

    if (this.onGraphSetupWithInputStream) {
      this.onGraphSetupWithInputStream(this.inputStreamNode);
    }

    // Build the audio graph
    this.inputStreamNode.connect(this.micGainNode!);
    this.micGainNode!.gain.setValueAtTime(
      this.config.micGain,
      this.audioCtx.currentTime
    );

    let nextNode: AudioNode = this.micGainNode!;
    if (this.dynamicsCompressorNode) {
      this.micGainNode!.connect(this.dynamicsCompressorNode);
      nextNode = this.dynamicsCompressorNode;
    }

    this.state = 'recording';

    if (this.processorNode) {
      nextNode.connect(this.processorNode);
      this.processorNode.connect(this.outputGainNode!);
      this.processorNode.onaudioprocess = (e) => this._onAudioProcess(e);
    } else {
      nextNode.connect(this.outputGainNode!);
    }

    if (this.analyserNode) {
      nextNode.connect(this.analyserNode);
    }

    this.outputGainNode!.connect(this.destinationNode!);

    if (this.usingMediaRecorder) {
      this.mediaRecorder = new MediaRecorder(
        (this.destinationNode as MediaStreamAudioDestinationNode).stream,
        { audioBitsPerSecond: this.config.audioBitsPerSecond }
      );
      this.mediaRecorder.addEventListener('dataavailable', (evt) =>
        this._onDataAvailable(evt as BlobEvent)
      );
      this.mediaRecorder.addEventListener('error', (evt) => this._onError(evt));
      this.mediaRecorder.start();
    } else {
      // Mute output while we manually encode
      this.outputGainNode!.gain.setValueAtTime(0, this.audioCtx.currentTime);
    }
  }

  private _onAudioProcess(e: AudioProcessingEvent): void {
    if (this.config.broadcastAudioProcessEvents) {
      this.em.dispatchEvent(
        new CustomEvent('onaudioprocess', {
          detail: {
            inputBuffer: e.inputBuffer,
            outputBuffer: e.outputBuffer,
          },
        })
      );
    }

    if (!this.usingMediaRecorder && this.state === 'recording') {
      const buffer =
        this.config.broadcastAudioProcessEvents
          ? e.outputBuffer.getChannelData(0)
          : e.inputBuffer.getChannelData(0);
      this.encoderWorker!.postMessage(['encode', buffer]);
    }
  }

  /**
   * Force a chunk dump.
   */
  processChunks(): void {
    if (this.state === 'inactive') {
      return;
    }
    this._dumpChunks();
  }

  private _dumpChunks(): void {
    if (this.usingMediaRecorder) {
      this.mediaRecorder!.requestData();
    } else {
      this.encoderWorker!.postMessage(['dump', this.audioCtx!.sampleRate]);
      clearInterval(this.slicing);
    }
  }

  /**
   * Stop recording and flush data.
   */
  stopRecording(): void {
    if (this.state === 'inactive') {
      return;
    }

    this.state = 'inactive';
    if (this.usingMediaRecorder) {
      this.mediaRecorder!.stop();
    } else {
      this.encoderWorker!.postMessage(['dump', this.audioCtx!.sampleRate]);
      clearInterval(this.slicing);
    }
  }

  private _onDataAvailable(evt: BlobEvent): void {
    this.chunks.push(evt.data);
    this.chunkType = evt.data.type;

    const blob = new Blob(this.chunks, { type: this.chunkType! });
    const blobUrl = URL.createObjectURL(blob);
    const recording: RecordingDetail = {
      ts: Date.now(),
      blobUrl,
      mimeType: blob.type,
      size: blob.size,
      blob,
    };

    this.em.dispatchEvent(
      new CustomEvent('recording', { detail: { recording } })
    );

    this.chunks = [];
    if (this.state === 'inactive') {
      this._cleanup();
    }
  }

  private _cleanup(): void {
    this.chunkType = null;

    [
      'destinationNode',
      'outputGainNode',
      'analyserNode',
      'processorNode',
      'dynamicsCompressorNode',
      'micGainNode',
      'inputStreamNode',
    ].forEach((field) => {
      const node = (this as any)[field];
      if (node) {
        node.disconnect();
        (this as any)[field] = null;
      }
    });

    if (this.encoderWorker) {
      this.encoderWorker.postMessage(['close']);
      this.encoderWorker = null;
    }

    if (
      this.config.stopTracksAndCloseCtxWhenFinished &&
      this.micAudioStream
    ) {
      this.micAudioStream.getTracks().forEach((t) => t.stop());
      this.micAudioStream = null;
      this.audioCtx!.close();
      this.audioCtx = null;
    }
  }

  private _onError(_: Event): void {
    this.em.dispatchEvent(new Event('error'));
  }
}
