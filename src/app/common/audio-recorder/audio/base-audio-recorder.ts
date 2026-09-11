import {Directive} from '@angular/core';
import {MediaRecorderService} from 'src/app/common/services/recorder-service';

export interface RecordingEvent extends Event {
  detail: {
    recording: {
      blob: Blob;
      blobUrl: string;
    };
  };
}

@Directive()
export abstract class BaseAudioRecorderComponent {
  protected mediaRecorder: MediaRecorderService = null;
  public recordingAvailable: boolean = false;
  public isRecording: boolean = false;
  protected isPlaying: boolean = false;
  protected audio: HTMLAudioElement;

  abstract isSending;
  abstract canvas: HTMLCanvasElement;
  abstract canvasCtx: CanvasRenderingContext2D;

  protected blob: Blob;

  get canRecord(): boolean {
    return Boolean(navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  constructor(private recorderService: MediaRecorderService) {}

  protected init(): void {
    this.isSending = false;
    this.blob = new Blob();
    this.mediaRecorder = this.recorderService;
    // Required for recording multiple times
    this.mediaRecorder.config.stopTracksAndCloseCtxWhenFinished = true;
    // Required for visualising the stream
    this.mediaRecorder.config.createAnalyserNode = true;
    this.mediaRecorder.em.addEventListener('recording', (evt: Event) =>
      this.onNewRecording(evt as RecordingEvent),
    );
  }

  playStop(): void {
    if (this.audio.paused) {
      this.audio.play();
      this.isPlaying = true;
    } else {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.isPlaying = false;
    }
  }

  recordingToggle(): void {
    if (!this.isRecording) {
      this.mediaRecorder.startRecording();
      this.visualise();
      this.isRecording = true;
    } else if (this.isRecording) {
      this.mediaRecorder.stopRecording();
      this.isRecording = false;
    }
  }

  stopRecording() {
    if (!this.audio.paused) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.isPlaying = false;
    }

    if (this.isRecording) {
      this.mediaRecorder.stopRecording();
      this.isRecording = false;
    }
  }

  startRecording(): void {
    if (!this.isRecording) {
      this.mediaRecorder.startRecording();
      this.visualise();
      this.isRecording = true;
    }
  }

  processChunks(): void {
    this.mediaRecorder.processChunks();
  }

  onNewRecording(evt: RecordingEvent): void {
    this.blob = evt.detail.recording.blob;
    this.audio.src = evt.detail.recording.blobUrl;
    this.audio.load();
    this.recordingAvailable = true;
  }

  // virtual implementation of visualise
  // Which can be overridden
  protected visualise(): void {
    const analyser = this.mediaRecorder.analyserNode;
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const bar_width = 2;
    const bar_gap = 2;

    const draw = () => {
      requestAnimationFrame(draw);

      this.canvas.width = this.canvas.clientWidth;
      this.canvas.height = this.canvas.clientHeight;
      const WIDTH = this.canvas.width;
      const HEIGHT = this.canvas.height;

      analyser.getByteFrequencyData(dataArray);

      this.canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
      this.canvasCtx.fillStyle = 'white';

      for (let i = 0; i < WIDTH; i++) {
        const bar_x = i * (bar_width + bar_gap);
        const bar_y = HEIGHT / 2;
        const bar_height = -(dataArray[i] / 8) + 1;
        this.canvasCtx.fillRect(bar_x, bar_y, bar_width, bar_height);
        this.canvasCtx.fillRect(bar_x, bar_y - bar_height, bar_width, bar_height);
      }
    };

    draw();
  }

  protected abstract sendRecording(): void;
}
