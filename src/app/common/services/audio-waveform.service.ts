import {Injectable} from '@angular/core';

const DEFAULT_WAVEFORM_BARS = 40;

/** Decode real channel samples into normalized peaks for compact feedback waveforms. */
@Injectable({providedIn: 'root'})
export class AudioWaveformService {
  async decodePeaks(
    sourceUrl: string,
    barCount: number = DEFAULT_WAVEFORM_BARS,
  ): Promise<number[]> {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Audio download failed with ${response.status}`);
    }

    const encodedAudio = await response.arrayBuffer();
    if (encodedAudio.byteLength === 0) {
      throw new Error('The audio recording is empty.');
    }

    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioContextConstructor) {
      throw new Error('Audio decoding is unavailable in this browser.');
    }

    const context = new AudioContextConstructor();
    try {
      const decodedAudio = await context.decodeAudioData(encodedAudio.slice(0));
      if (!Number.isFinite(decodedAudio.duration) || decodedAudio.duration <= 0) {
        throw new Error('The audio recording has no playable duration.');
      }
      return this.calculatePeaks(decodedAudio, barCount);
    } finally {
      await context.close().catch(() => undefined);
    }
  }

  calculatePeaks(
    audio: Pick<AudioBuffer, 'length' | 'numberOfChannels' | 'getChannelData'>,
    barCount: number,
  ): number[] {
    const safeBarCount = Math.max(1, Math.floor(barCount));
    if (audio.length <= 0 || audio.numberOfChannels <= 0) {
      return Array.from({length: safeBarCount}, () => 0);
    }

    const peaks = Array.from({length: safeBarCount}, (_, barIndex) => {
      const start = Math.min(
        audio.length - 1,
        Math.floor((barIndex * audio.length) / safeBarCount),
      );
      const end = Math.min(
        audio.length,
        Math.max(start + 1, Math.floor(((barIndex + 1) * audio.length) / safeBarCount)),
      );
      let peak = 0;

      for (let channel = 0; channel < audio.numberOfChannels; channel++) {
        const samples = audio.getChannelData(channel);
        for (let sampleIndex = start; sampleIndex < end; sampleIndex++) {
          peak = Math.max(peak, Math.abs(samples[sampleIndex] || 0));
        }
      }
      return peak;
    });

    const maximum = Math.max(...peaks);
    return maximum > 0 ? peaks.map((peak) => peak / maximum) : peaks;
  }
}
