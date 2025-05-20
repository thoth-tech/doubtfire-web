import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class RecorderService {
  public analyserNode: AnalyserNode | null = null;

  private em = document.createDocumentFragment();
  private state: 'inactive' | 'recording' | 'paused' = 'inactive';
  private audioCtx: AudioContext;
  private chunks: BlobPart[] = [];
  private chunkType = '';
  private usingMediaRecorder: any;
  private encoderMimeType = '';

  private config = {
    broadcastAudioProcessEvents: false,
    createAnalyserNode: true,
    createDynamicsCompressorNode: false,
    forceScriptProcessor: false,
    stopTracksAndCloseCtxWhenFinished: true
  };

  constructor() {
    window.AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioContext();
    this.usingMediaRecorder = (window as any).MediaRecorder || false;

    if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
      this.usingMediaRecorder = false;
    }

    // Create analyser node early if config says so
    if (this.config.createAnalyserNode) {
      this.analyserNode = this.audioCtx.createAnalyser();
      console.log('AnalyserNode created');
    }
  }

  startRecording(): void {
    this.state = 'recording';
    console.log('Recording started');

    // Optional: prepare chunks
    this.chunks = [];

    // In a real implementation, set up MediaRecorder here
    // and hook into audio stream
  }

  stopRecording(): void {
    this.state = 'inactive';
    console.log('Recording stopped');

    // Process blobs or emit event here
    const fakeBlob = new Blob(this.chunks, { type: this.chunkType || 'audio/webm' });
    const event = new CustomEvent('recording', {
      detail: {
        recording: {
          blob: fakeBlob,
          blobUrl: URL.createObjectURL(fakeBlob)
        }
      }
    });

    this.em.dispatchEvent(event);
  }

  getState(): string {
    return this.state;
  }

  // Optional event emitter getter for integration with BaseAudioRecorderComponent
  get emRef(): DocumentFragment {
    return this.em;
  }

  // Stub for visualisation buffer access, if needed
  getAudioContext(): AudioContext {
    return this.audioCtx;
  }
}
