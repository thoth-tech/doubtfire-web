import {Directive, OnDestroy} from '@angular/core';
import {Subscription} from 'rxjs';
import {AppLifecycleService} from 'src/app/common/services/app-lifecycle.service';
import {AudioPlaybackCoordinatorService} from 'src/app/common/services/audio-playback-coordinator.service';
import {MediaRecorderService, RecorderFailureEvent} from 'src/app/common/services/recorder-service';

export interface RecordingEvent extends Event {
  detail: {
    recording: {
      blob: Blob;
    };
  };
}

@Directive()
export abstract class BaseAudioRecorderComponent implements OnDestroy {
  protected mediaRecorder: MediaRecorderService = null;
  public recordingAvailable = false;
  public isRecording = false;
  public isRequestingPermission = false;
  public recordingError: string | null = null;
  public playbackProgress = 0;
  protected isPlaying = false;
  protected audio: HTMLAudioElement;

  abstract isSending;
  abstract canvas: HTMLCanvasElement;
  abstract canvasCtx: CanvasRenderingContext2D;

  protected blob: Blob = new Blob();
  protected capturedWaveform: number[] = [];
  protected animationFrameId?: number;
  private previewUrl?: string;
  private unregisterMedia?: () => void;
  private lifecycleSubscription?: Subscription;
  private destroyed = false;

  private readonly recordingListener = (event: Event) =>
    this.onNewRecording(event as RecordingEvent);
  private readonly recorderErrorListener = (event: Event) =>
    this.onRecorderError(event as RecorderFailureEvent);
  private readonly audioTimeUpdateListener = () => {
    const duration = this.audio?.duration;
    this.playbackProgress =
      Number.isFinite(duration) && duration > 0
        ? Math.min(100, Math.max(0, (this.audio.currentTime / duration) * 100))
        : 0;
    this.drawCapturedWaveform();
  };
  private readonly audioEndedListener = () => {
    this.isPlaying = false;
    this.playbackCoordinator?.release(this.audio);
    if (this.audio) {
      this.audio.currentTime = 0;
    }
    this.playbackProgress = 0;
    this.drawCapturedWaveform();
  };
  private readonly audioErrorListener = () => {
    this.isPlaying = false;
    this.playbackCoordinator?.release(this.audio);
    this.recordingError = 'This recording could not be played. Record it again and retry.';
  };

  get canRecord(): boolean {
    return Boolean(navigator?.mediaDevices?.getUserMedia);
  }

  constructor(
    private recorderService: MediaRecorderService,
    private playbackCoordinator?: AudioPlaybackCoordinatorService,
    private appLifecycle?: AppLifecycleService,
  ) {
    this.lifecycleSubscription = this.appLifecycle?.mediaPauseSubject.subscribe(() =>
      this.onLifecyclePause(),
    );
  }

  /**
   * Backgrounding the app or leaving the route ends the take, so the microphone
   * is not left open. Subclasses whose stop has side effects can override this.
   */
  protected onLifecyclePause(): void {
    this.isPlaying = false;
    if (this.isRecording || this.isRequestingPermission) {
      this.stopRecording();
    }
  }

  protected init(): void {
    this.destroyed = false;
    this.isSending = false;
    this.blob = new Blob();
    this.mediaRecorder = this.recorderService;
    this.mediaRecorder.config.stopTracksAndCloseCtxWhenFinished = true;
    this.mediaRecorder.config.createAnalyserNode = true;
    this.mediaRecorder.em.addEventListener('recording', this.recordingListener);
    this.mediaRecorder.em.addEventListener('error', this.recorderErrorListener);
  }

  protected attachAudio(audio: HTMLAudioElement): void {
    this.detachAudio();
    this.audio = audio;
    this.audio.addEventListener('timeupdate', this.audioTimeUpdateListener);
    this.audio.addEventListener('ended', this.audioEndedListener);
    this.audio.addEventListener('error', this.audioErrorListener);
    this.unregisterMedia = this.appLifecycle?.registerMedia(this.audio);
  }

  async playStop(): Promise<void> {
    if (!this.audio || !this.recordingAvailable) {
      return;
    }
    if (!this.audio.paused) {
      this.pausePreview();
      return;
    }

    this.recordingError = null;
    this.playbackCoordinator?.activate(this.audio, () => {
      this.isPlaying = false;
      this.drawCapturedWaveform();
    });
    try {
      await Promise.resolve(this.audio.play());
      if (!this.playbackCoordinator || this.playbackCoordinator.isActive(this.audio)) {
        this.isPlaying = true;
      }
    } catch {
      this.playbackCoordinator?.release(this.audio);
      this.isPlaying = false;
      this.recordingError = 'This recording could not be played. Record it again and retry.';
    }
  }

  recordingToggle(): void {
    if (this.isRequestingPermission) {
      this.mediaRecorder.cancelRecording();
      this.isRequestingPermission = false;
      return;
    }
    if (this.isRecording) {
      this.finishRecording();
    } else {
      void this.beginRecording();
    }
  }

  stopRecording(): void {
    this.pausePreview();
    if (this.isRequestingPermission) {
      this.mediaRecorder.cancelRecording();
      this.isRequestingPermission = false;
    } else if (this.isRecording) {
      this.finishRecording();
    }
  }

  startRecording(): void {
    if (!this.isRecording && !this.isRequestingPermission) {
      void this.beginRecording();
    }
  }

  processChunks(): void {
    this.mediaRecorder.processChunks();
  }

  onNewRecording(event: RecordingEvent): void {
    const recording = event.detail.recording.blob;
    this.isRecording = false;
    this.isRequestingPermission = false;
    this.stopVisualisation();

    if (!recording || recording.size === 0) {
      this.recordingAvailable = false;
      this.recordingError = 'The recording was empty. Record it again and retry.';
      this.drawCapturedWaveform();
      return;
    }

    this.blob = recording;
    this.replacePreviewUrl(URL.createObjectURL(recording));
    this.recordingAvailable = true;
    this.recordingError = null;
    this.playbackProgress = 0;
    this.drawCapturedWaveform();
  }

  public seekPreview(event: MouseEvent): void {
    if (
      !this.audio ||
      !this.canvas ||
      !Number.isFinite(this.audio.duration) ||
      this.audio.duration <= 0
    ) {
      return;
    }
    const width = this.canvas.getBoundingClientRect().width || this.canvas.clientWidth;
    if (width <= 0) {
      return;
    }
    this.setPreviewProgress(event.offsetX / width);
  }

  public seekPreviewWithKeyboard(event: KeyboardEvent): void {
    if (!this.audio || !Number.isFinite(this.audio.duration) || this.audio.duration <= 0) {
      return;
    }
    const current = this.audio.currentTime / this.audio.duration;
    let next = current;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      next -= 0.05;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      next += 0.05;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = 1;
    } else {
      return;
    }
    event.preventDefault();
    this.setPreviewProgress(next);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopVisualisation();
    this.mediaRecorder?.em.removeEventListener('recording', this.recordingListener);
    this.mediaRecorder?.em.removeEventListener('error', this.recorderErrorListener);
    this.mediaRecorder?.dispose();
    this.lifecycleSubscription?.unsubscribe();
    this.lifecycleSubscription = undefined;
    this.pausePreview();
    this.detachAudio();
    this.releasePreviewUrl();
  }

  protected discardRecording(): void {
    this.pausePreview();
    this.blob = new Blob();
    this.recordingAvailable = false;
    this.playbackProgress = 0;
    this.capturedWaveform = [];
    this.releasePreviewUrl();
    this.drawCapturedWaveform();
  }

  protected visualise(): void {
    const analyser = this.mediaRecorder.analyserNode;
    if (!analyser) {
      return;
    }
    analyser.fftSize = 2048;
    const samples = new Uint8Array(analyser.fftSize);
    this.capturedWaveform = [];

    const draw = () => {
      if (!this.isRecording || this.destroyed) {
        this.animationFrameId = undefined;
        return;
      }
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      for (const sample of samples) {
        peak = Math.max(peak, Math.abs(sample - 128) / 128);
      }
      this.capturedWaveform.push(peak);
      if (this.capturedWaveform.length > 48) {
        this.capturedWaveform.shift();
      }
      this.drawCapturedWaveform();
      this.scheduleVisualisationFrame(draw);
    };
    draw();
  }

  protected stopVisualisation(): void {
    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
  }

  protected scheduleVisualisationFrame(callback: FrameRequestCallback): void {
    if (this.isRecording && !this.destroyed) {
      this.animationFrameId = requestAnimationFrame(callback);
    }
  }

  protected abstract sendRecording(): void;

  private async beginRecording(): Promise<void> {
    this.discardRecording();
    this.recordingError = null;
    this.isRequestingPermission = true;
    try {
      await this.mediaRecorder.startRecording();
      this.isRequestingPermission = false;
      if (this.mediaRecorder.state === 'recording' && !this.destroyed) {
        this.isRecording = true;
        this.visualise();
      }
    } catch (error) {
      this.isRequestingPermission = false;
      this.isRecording = false;
      this.recordingError = this.describeRecorderError(error);
    }
  }

  private finishRecording(): void {
    this.isRecording = false;
    this.stopVisualisation();
    this.mediaRecorder.stopRecording();
    this.drawCapturedWaveform();
  }

  private onRecorderError(event: RecorderFailureEvent): void {
    this.isRequestingPermission = false;
    this.isRecording = false;
    this.stopVisualisation();
    this.recordingError = this.describeRecorderError(event.detail.error);
  }

  private describeRecorderError(error: unknown): string {
    const errorName = (error as {name?: string})?.name;
    if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
      return 'Microphone permission was denied. Allow microphone access, then try again.';
    }
    if (errorName === 'NotFoundError') {
      return 'No microphone was found. Connect a microphone, then try again.';
    }
    return 'Audio recording could not start. Check the microphone and try again.';
  }

  private pausePreview(): void {
    if (!this.audio) {
      return;
    }
    this.audio.pause();
    this.playbackCoordinator?.release(this.audio);
    this.isPlaying = false;
  }

  private setPreviewProgress(progress: number): void {
    const clamped = Math.min(1, Math.max(0, progress));
    this.audio.currentTime = clamped * this.audio.duration;
    this.playbackProgress = clamped * 100;
    this.drawCapturedWaveform();
  }

  private replacePreviewUrl(url: string): void {
    this.releasePreviewUrl();
    this.previewUrl = url;
    if (this.audio) {
      this.audio.src = url;
      this.audio.load();
    }
  }

  private releasePreviewUrl(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      if (this.audio?.src === this.previewUrl) {
        this.audio.removeAttribute('src');
        this.audio.load();
      }
      this.previewUrl = undefined;
    }
  }

  private detachAudio(): void {
    if (!this.audio) {
      return;
    }
    this.playbackCoordinator?.release(this.audio);
    this.unregisterMedia?.();
    this.unregisterMedia = undefined;
    this.audio.removeEventListener('timeupdate', this.audioTimeUpdateListener);
    this.audio.removeEventListener('ended', this.audioEndedListener);
    this.audio.removeEventListener('error', this.audioErrorListener);
  }

  private drawCapturedWaveform(): void {
    if (!this.canvas || !this.canvasCtx) {
      return;
    }
    this.canvas.width = this.canvas.clientWidth || this.canvas.width;
    this.canvas.height = this.canvas.clientHeight || this.canvas.height;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const values = this.capturedWaveform.length > 0 ? this.capturedWaveform : [0];
    const barWidth = Math.max(1, width / values.length - 2);

    this.canvasCtx.clearRect(0, 0, width, height);
    values.forEach((value, index) => {
      const x = (index * width) / values.length;
      const amplitude = Math.max(2, Math.min(height, value * height));
      const played = this.isRecording || x / Math.max(1, width) <= this.playbackProgress / 100;
      this.canvasCtx.fillStyle = played ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
      this.canvasCtx.fillRect(x, (height - amplitude) / 2, barWidth, amplitude);
    });
  }
}
