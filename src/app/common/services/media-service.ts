import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private audioCtx: AudioContext;

  constructor() {
    this.audioCtx = new (window.AudioContext ||
      (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)();
  }

  getMimeType(): string {
    let mimeType = 'audio/webm';

    if (!('MediaRecorder' in window)) {
      return '';
    }

    if (!MediaRecorder.isTypeSupported(mimeType)) {
      const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
      mimeType = isFirefox ? 'audio/ogg' : '';
    }

    return mimeType;
  }

  getAudioContext(): AudioContext {
    return this.audioCtx;
  }
}
