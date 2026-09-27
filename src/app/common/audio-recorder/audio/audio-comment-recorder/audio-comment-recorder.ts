import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import {Task} from 'src/app/api/models/doubtfire-model';
import {AppLifecycleService} from 'src/app/common/services/app-lifecycle.service';
import {AudioPlaybackCoordinatorService} from 'src/app/common/services/audio-playback-coordinator.service';
import {MediaRecorderService} from 'src/app/common/services/recorder-service';
import {BaseAudioRecorderComponent, RecordingEvent} from '../base-audio-recorder';

@Component({
  selector: 'audio-comment-recorder',
  templateUrl: './audio-comment-recorder.html',
  providers: [MediaRecorderService],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AudioCommentRecorderComponent
  extends BaseAudioRecorderComponent
  implements AfterViewInit
{
  @Input() task: Task;
  @Output() recordingReady: EventEmitter<Blob> = new EventEmitter();
  @ViewChild('audioRecorderVisualiser') canvasRef: ElementRef<HTMLCanvasElement>;
  @ViewChild('audioRecorderPlayer') audioRef: ElementRef<HTMLAudioElement>;
  canvas: HTMLCanvasElement;
  canvasCtx: CanvasRenderingContext2D;
  isSending: boolean = false;

  constructor(
    private mediaRecorderService: MediaRecorderService,
    playbackCoordinator: AudioPlaybackCoordinatorService,
    appLifecycle: AppLifecycleService,
  ) {
    super(mediaRecorderService, playbackCoordinator, appLifecycle);
  }

  ngAfterViewInit(): void {
    if (this.canRecord) {
      this.init();
    }
  }

  init(): void {
    super.init();
    this.canvas = this.canvasRef.nativeElement;
    this.attachAudio(this.audioRef.nativeElement);
    this.canvasCtx = this.canvas.getContext('2d');
  }

  override onNewRecording(event: RecordingEvent): void {
    super.onNewRecording(event);
    if (this.recordingAvailable && this.blob.size > 0) {
      this.recordingReady.emit(this.blob);
    }
  }

  sendRecording(): void {
    if (this.recordingAvailable && this.blob.size > 0) {
      this.recordingReady.emit(this.blob);
    }
  }
}
