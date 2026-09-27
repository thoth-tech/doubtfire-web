import {afterEach, describe, expect, it, vi} from 'vitest';
import {AudioWaveformService} from './audio-waveform.service';

describe('AudioWaveformService', () => {
  const service = new AudioWaveformService();

  afterEach(() => vi.restoreAllMocks());

  it('calculates normalized peaks from real channel samples', () => {
    const samples = new Float32Array([0, 0.25, -0.5, 1]);
    const peaks = service.calculatePeaks(
      {length: samples.length, numberOfChannels: 1, getChannelData: () => samples},
      2,
    );

    expect(peaks).toEqual([0.25, 1]);
  });

  it('keeps a valid very short clip finite across every bar', () => {
    const samples = new Float32Array([0.4]);
    const peaks = service.calculatePeaks(
      {length: 1, numberOfChannels: 1, getChannelData: () => samples},
      8,
    );

    expect(peaks).toHaveLength(8);
    expect(peaks.every((peak) => Number.isFinite(peak) && peak === 1)).toBe(true);
  });

  it('closes its decoding context when corrupt audio fails to decode', async () => {
    const close = vi.fn(() => Promise.resolve());
    const decodeAudioData = vi.fn(() =>
      Promise.reject(new DOMException('bad audio', 'EncodingError')),
    );
    const originalAudioContext = window.AudioContext;
    const originalFetch = globalThis.fetch;
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: class {
        close = close;
        decodeAudioData = decodeAudioData;
      },
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi.fn(() =>
        Promise.resolve({ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4))}),
      ),
    });

    await expect(service.decodePeaks('blob:corrupt')).rejects.toMatchObject({
      name: 'EncodingError',
    });
    expect(close).toHaveBeenCalledOnce();

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: originalAudioContext,
    });
    Object.defineProperty(globalThis, 'fetch', {configurable: true, value: originalFetch});
  });
});
