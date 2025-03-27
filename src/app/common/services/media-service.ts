import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private audioCtx: AudioContext; // stores the AudioContext instance

  constructor() {
    this.audioCtx = new (window.AudioContext ||
      (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)();
  }

  getMimeType(): string {
    let mimeType = 'audio/webm'; // default MIME type

    // check's if MediaRecorder is supported by the browser
    if (!('MediaRecorder' in window)) {
      return ''; // return empty string if MediaRecorder is not available
    }

    if (!MediaRecorder.isTypeSupported(mimeType)) {
      const isFirefox = navigator.userAgent.toLowerCase().includes('firefox'); // detect's Firefox
      mimeType = isFirefox ? 'audio/ogg' : ''; // 'audio/ogg' is used for Firefox, otherwise return empty string
    }

    return mimeType;
  }

  // retrieves the AudioContext instance for managing audio operations
  getAudioContext(): AudioContext {
    return this.audioCtx;
  }
}
