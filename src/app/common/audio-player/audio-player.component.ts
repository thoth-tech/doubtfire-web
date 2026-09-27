import {HttpResponse} from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import {Subscription} from 'rxjs';
import {Project, Task, TaskComment} from 'src/app/api/models/doubtfire-model';
import {FileDownloaderService} from '../file-downloader/file-downloader.service';
import {AlertService} from '../services/alert.service';
import {AppLifecycleService} from '../services/app-lifecycle.service';
import {AudioPlaybackCoordinatorService} from '../services/audio-playback-coordinator.service';
import {AudioWaveformService} from '../services/audio-waveform.service';

const WAVEFORM_BAR_COUNT = 40;

@Component({
  selector: 'audio-player',
  templateUrl: './audio-player.component.html',
  styleUrls: ['./audio-player.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AudioPlayerComponent implements OnDestroy {
  @Input() project: Project;
  @Input() task: Task;
  @Input() comment: TaskComment;
  @Input() audioSrc: {src: string};
  @Output() playingChange: EventEmitter<boolean> = new EventEmitter();

  @ViewChild('progressBar', {read: ElementRef}) private progressBar: ElementRef<HTMLElement>;

  public isPlaying = false;
  public audioProgress = 0;
  public duration = 0;
  public audioError: string | null = null;
  public waveformUnavailable = false;
  public waveformPeaks: number[] = Array.from({length: WAVEFORM_BAR_COUNT}, () => 0.12);
  public audio: HTMLAudioElement = document.createElement('audio');

  private isLoaded = false;
  private isLoading = false;
  private destroyed = false;
  private sourceGeneration = 0;
  private pendingActions: Array<() => void> = [];
  private readonly unregisterMedia: () => void;
  private readonly lifecycleSubscription: Subscription;

  constructor(
    @Inject(FileDownloaderService) private fileDownloader: FileDownloaderService,
    private alerts: AlertService,
    private appLifecycle: AppLifecycleService,
    private playbackCoordinator: AudioPlaybackCoordinatorService,
    private waveformService: AudioWaveformService,
  ) {
    this.unregisterMedia = this.appLifecycle.registerMedia(this.audio);
    this.lifecycleSubscription = this.appLifecycle.mediaPauseSubject.subscribe(() => {
      // A play queued behind a slow download must not start after the pause.
      this.pendingActions = [];
      this.updatePlaying(false);
      this.playbackCoordinator.release(this.audio);
    });

    this.audio.ontimeupdate = () => {
      this.duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
      const percentagePlayed = this.duration > 0 ? this.audio.currentTime / this.duration : 0;
      this.audioProgress = Math.min(100, Math.max(0, percentagePlayed * 100));
    };
    this.audio.onloadedmetadata = () => {
      this.duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
      if (this.duration <= 0) {
        this.setPlaybackError('This audio message has no playable duration.');
      }
    };
    this.audio.onended = () => {
      this.playbackCoordinator.release(this.audio);
      this.updatePlaying(false);
      this.audio.currentTime = 0;
      this.audioProgress = 0;
    };
    this.audio.onerror = () => {
      this.playbackCoordinator.release(this.audio);
      this.setPlaybackError('This audio message could not be played.');
    };
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.sourceGeneration++;
    this.audio.pause();
    this.playbackCoordinator.release(this.audio);
    this.unregisterMedia();
    this.lifecycleSubscription.unsubscribe();
    this.audio.ontimeupdate = null;
    this.audio.onloadedmetadata = null;
    this.audio.onended = null;
    this.audio.onerror = null;
    this.releaseCurrentSource();
    this.pendingActions = [];
  }

  public seek(event: MouseEvent): void {
    this.withAudio(() => {
      const width = this.progressBar?.nativeElement.getBoundingClientRect().width;
      if (!width || !Number.isFinite(this.audio.duration) || this.audio.duration <= 0) {
        return;
      }
      this.setProgress(event.offsetX / width);
    });
  }

  public seekWithKeyboard(event: KeyboardEvent): void {
    if (!this.isLoaded || !Number.isFinite(this.audio.duration) || this.audio.duration <= 0) {
      return;
    }
    const currentProgress = this.audio.currentTime / this.audio.duration;
    let nextProgress = currentProgress;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      nextProgress -= 0.05;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      nextProgress += 0.05;
    } else if (event.key === 'Home') {
      nextProgress = 0;
    } else if (event.key === 'End') {
      nextProgress = 1;
    } else {
      return;
    }
    event.preventDefault();
    this.setProgress(nextProgress);
  }

  public setSrc(src: string): void {
    this.sourceGeneration++;
    const generation = this.sourceGeneration;
    this.audio.pause();
    this.playbackCoordinator.release(this.audio);
    this.releaseCurrentSource();
    this.isLoaded = true;
    this.isLoading = false;
    this.audioError = null;
    this.waveformUnavailable = false;
    this.duration = 0;
    this.audioProgress = 0;
    this.updatePlaying(false);
    this.audio.src = src;
    this.audio.load();
    void this.loadWaveform(src, generation);
  }

  public play(): void {
    this.withAudio(() => void this.startPlayback());
  }

  public pause(): void {
    this.audio.pause();
    this.playbackCoordinator.release(this.audio);
    this.updatePlaying(false);
  }

  public stop(): void {
    this.pause();
    this.audio.currentTime = 0;
    this.audioProgress = 0;
  }

  public pausePlay(): void {
    if (this.isLoaded && !this.audio.paused) {
      this.pause();
    } else {
      this.play();
    }
  }

  public isBarPlayed(index: number): boolean {
    return ((index + 1) / this.waveformPeaks.length) * 100 <= this.audioProgress;
  }

  public formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '0:00';
    }
    const wholeSeconds = Math.floor(seconds);
    return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
  }

  private setProgress(progress: number): void {
    const clamped = Math.min(1, Math.max(0, progress));
    this.audio.currentTime = clamped * this.audio.duration;
    this.audioProgress = clamped * 100;
  }

  private withAudio(action: () => void): void {
    if (this.isLoaded) {
      action();
      return;
    }
    this.pendingActions.push(action);
    if (this.isLoading) {
      return;
    }

    let url: string;
    if (this.project && this.task && this.comment) {
      url = this.comment.attachmentUrl;
    } else if (this.audioSrc) {
      url = this.audioSrc.src;
    }
    if (!url) {
      this.pendingActions = [];
      this.setPlaybackError('This audio message has no source.');
      return;
    }

    this.isLoading = true;
    this.fileDownloader.downloadBlob(
      url,
      (blobUrl: string, _response: HttpResponse<Blob>) => {
        if (this.destroyed) {
          this.fileDownloader.releaseBlob(blobUrl);
          return;
        }
        this.setSrc(blobUrl);
        const actions = this.pendingActions;
        this.pendingActions = [];
        actions.forEach((pendingAction) => pendingAction());
      },
      (error: Error) => {
        this.isLoading = false;
        this.pendingActions = [];
        this.setPlaybackError(`Error loading audio. ${error}`);
      },
    );
  }

  private async startPlayback(): Promise<void> {
    this.audioError = null;
    this.playbackCoordinator.activate(this.audio, () => this.updatePlaying(false));
    try {
      await Promise.resolve(this.audio.play());
      if (this.playbackCoordinator.isActive(this.audio)) {
        this.updatePlaying(true);
      }
    } catch (error) {
      this.playbackCoordinator.release(this.audio);
      this.setPlaybackError(`This audio message could not be played. ${String(error)}`);
    }
  }

  private async loadWaveform(src: string, generation: number): Promise<void> {
    try {
      const peaks = await this.waveformService.decodePeaks(src, WAVEFORM_BAR_COUNT);
      if (!this.destroyed && generation === this.sourceGeneration) {
        this.waveformPeaks = peaks;
      }
    } catch {
      if (!this.destroyed && generation === this.sourceGeneration) {
        // Playback can still work when Web Audio decoding is unavailable.
        this.waveformUnavailable = true;
        this.waveformPeaks = Array.from({length: WAVEFORM_BAR_COUNT}, () => 0.12);
      }
    }
  }

  private setPlaybackError(message: string): void {
    this.audioError = message;
    this.updatePlaying(false);
    this.alerts.error(message, 6000);
  }

  private updatePlaying(isPlaying: boolean): void {
    if (this.isPlaying === isPlaying) {
      return;
    }
    this.isPlaying = isPlaying;
    this.playingChange.emit(isPlaying);
  }

  private releaseCurrentSource(): void {
    if (this.audio.src) {
      this.fileDownloader.releaseBlob(this.audio.src);
      this.audio.removeAttribute('src');
    }
  }
}
