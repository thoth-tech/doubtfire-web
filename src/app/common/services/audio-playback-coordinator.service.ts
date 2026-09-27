import {Injectable} from '@angular/core';

interface ActivePlayback {
  media: HTMLMediaElement;
  onInterrupted: () => void;
}

/**
 * Keeps feedback audio mutually exclusive without coupling individual comment
 * components to their neighbours.
 */
@Injectable({providedIn: 'root'})
export class AudioPlaybackCoordinatorService {
  private activePlayback?: ActivePlayback;

  activate(media: HTMLMediaElement, onInterrupted: () => void): void {
    const previous = this.activePlayback;
    if (previous?.media === media) {
      previous.onInterrupted = onInterrupted;
      return;
    }

    this.activePlayback = {media, onInterrupted};
    if (previous) {
      previous.media.pause();
      previous.onInterrupted();
    }
  }

  release(media: HTMLMediaElement): void {
    if (this.activePlayback?.media === media) {
      this.activePlayback = undefined;
    }
  }

  isActive(media: HTMLMediaElement): boolean {
    return this.activePlayback?.media === media;
  }
}
