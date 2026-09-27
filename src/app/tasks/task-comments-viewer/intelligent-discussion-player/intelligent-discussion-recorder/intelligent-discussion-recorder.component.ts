import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  ViewChild,
} from '@angular/core';
import {DiscussionComment, Task} from 'src/app/api/models/doubtfire-model';
import {TaskCommentService} from 'src/app/api/models/doubtfire-model';
import {
  BaseAudioRecorderComponent,
  RecordingEvent,
} from 'src/app/common/audio-recorder/audio/base-audio-recorder';
import {AppLifecycleService} from 'src/app/common/services/app-lifecycle.service';
import {AudioPlaybackCoordinatorService} from 'src/app/common/services/audio-playback-coordinator.service';
import {MediaRecorderService} from 'src/app/common/services/recorder-service';

@Component({
  selector: 'intelligent-discussion-recorder',
  templateUrl: './intelligent-discussion-recorder.component.html',
  styleUrls: ['./intelligent-discussion-recorder.component.css'],
  providers: [MediaRecorderService],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class IntelligentDiscussionRecorderComponent
  extends BaseAudioRecorderComponent
  implements AfterViewInit
{
  @Input() countdownText: number;
  @Input() discussion: DiscussionComment;
  @Input() promptActive = false;
  @Input() task: Task;
  @ViewChild('mainDiscussionRecorderVisualiser') canvasRef: ElementRef<HTMLCanvasElement>;
  canvas: HTMLCanvasElement;
  canvasCtx: CanvasRenderingContext2D;
  isSending: boolean = false;

  constructor(
    private mediaRecorderService: MediaRecorderService,
    private taskCommentService: TaskCommentService,
    playbackCoordinator: AudioPlaybackCoordinatorService,
    appLifecycle: AppLifecycleService,
  ) {
    super(mediaRecorderService, playbackCoordinator, appLifecycle);
  }

  ngAfterViewInit() {
    if (this.canRecord) {
      this.init();
    }
  }

  init(): void {
    super.init();
    this.canvas = this.canvasRef.nativeElement;
    this.canvasCtx = this.canvas.getContext('2d');
    this.clearWaveform();
  }

  onNewRecording(evt: RecordingEvent): void {
    this.blob = evt.detail.recording.blob;
    this.recordingAvailable = true;
    this.sendRecording();
  }

  stopRecording() {
    this.isPlaying = false;
    if (this.isRecording) {
      this.mediaRecorder.stopRecording();
      this.isRecording = false;
      this.clearWaveform();
    }
  }

  /** Ends the take without producing a recording, so nothing is posted. */
  cancelRecording(): void {
    this.isPlaying = false;
    if (this.isRecording || this.isRequestingPermission) {
      this.mediaRecorder.cancelRecording();
      this.isRecording = false;
      this.isRequestingPermission = false;
      this.stopVisualisation();
      this.clearWaveform();
    }
  }

  // A stop posts the take as the student's reply, and the API marks the
  // discussion complete. A backgrounded take is only part of an answer, so it
  // is dropped instead and the dialog asks the student to start again.
  protected onLifecyclePause(): void {
    this.cancelRecording();
  }

  sendRecording() {
    if (this.blob && this.blob.size > 0) {
      this.isSending = true;
      this.taskCommentService.postDiscussionReply(this.discussion, this.blob).subscribe({
        next: () => {
          this.isSending = false;
        },
        error: (failure: {data: {error: string}}) => {
          console.error(failure);
          this.isSending = false;
        },
      });
      this.blob = {} as Blob;
    }
  }

  protected visualise(): void {
    const draw = () => {
      let WIDTH: number;
      let HEIGHT: number;

      this.resolveWaveformColours();

      this.canvas.width = 1;
      this.canvas.height = 1;

      this.canvas.width = WIDTH = this.canvas.clientWidth;
      this.canvas.height = HEIGHT = this.canvas.clientHeight;
      this.scheduleVisualisationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      analyser.getByteFrequencyData(dataArray);

      this.canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

      const barWidth = 2;
      const barGap = 2;

      for (let i = 0; i < WIDTH; i++) {
        const barX = i * (barWidth + barGap);
        const barY = HEIGHT / 2;
        const barHeight = -(dataArray[i] / 8) + 1;
        this.canvasCtx.fillStyle = this.waveformColour;
        this.canvasCtx.fillRect(barX, barY, barWidth, barHeight);
        this.canvasCtx.fillRect(barX, barY - barHeight, barWidth, barHeight);
      }
    };

    const analyser = this.mediaRecorder.analyserNode;
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    draw();
  }

  // Waveform fill colours are read from the theme tokens so the visualiser flips with the
  // panel. getComputedStyle is resolved once per animation frame (see resolveWaveformColours),
  // never inside the per-bar draw loop where the getter is read.
  private waveformIdleColour = '#2563eb';
  private waveformRecordingColour = '#dc2626';
  private waveformRecordingMutedColour = '#b91c1c66';

  private resolveWaveformColours(): void {
    const styles = getComputedStyle(document.documentElement);
    const idle = styles.getPropertyValue('--ot-color-primary').trim();
    const error = styles.getPropertyValue('--ot-color-error').trim();
    if (idle) {
      this.waveformIdleColour = idle;
    }
    if (error) {
      this.waveformRecordingColour = error;
      this.waveformRecordingMutedColour = `color-mix(in srgb, ${error} 40%, transparent)`;
    }
  }

  private get waveformColour(): string {
    if (!this.isRecording) {
      return this.waveformIdleColour;
    }

    return this.promptActive ? this.waveformRecordingMutedColour : this.waveformRecordingColour;
  }

  private clearWaveform(): void {
    if (!this.canvas || !this.canvasCtx) {
      return;
    }

    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;

    this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
