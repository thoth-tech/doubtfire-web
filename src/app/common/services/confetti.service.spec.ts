import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {CONFETTI, ConfettiService} from './confetti.service';

describe('ConfettiService', () => {
  let service: ConfettiService;
  let originalMatchMedia: PropertyDescriptor | undefined;
  const confetti = vi.fn();

  function setMatchMedia(value: typeof window.matchMedia | undefined): void {
    Object.defineProperty(window, 'matchMedia', {configurable: true, writable: true, value});
  }

  beforeEach(() => {
    originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    TestBed.configureTestingModule({providers: [{provide: CONFETTI, useValue: confetti}]});
    service = TestBed.inject(ConfettiService);
    confetti.mockClear();
  });

  afterEach(() => {
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    } else {
      delete (window as unknown as {matchMedia?: unknown}).matchMedia;
    }
  });

  it('does not launch particles when reduced motion is requested', () => {
    const matchMedia = vi.fn().mockReturnValue({matches: true} as MediaQueryList);
    setMatchMedia(matchMedia);

    service.canon(0.95, 0.05, 210);

    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(confetti).not.toHaveBeenCalled();
  });

  it('keeps the celebration when reduced motion is not requested', () => {
    setMatchMedia(vi.fn().mockReturnValue({matches: false} as MediaQueryList));

    service.canon(0.95, 0.05, 210);

    expect(confetti).toHaveBeenCalledExactlyOnceWith({
      angle: 210,
      spread: 80,
      particleCount: 100,
      origin: {x: 0.95, y: 0.05},
    });
  });

  it('checks the current preference for every celebration', () => {
    setMatchMedia(
      vi.fn().mockReturnValueOnce({matches: false}).mockReturnValueOnce({matches: true}),
    );

    service.canon();
    service.canon();

    expect(confetti).toHaveBeenCalledTimes(1);
  });

  it('supports environments without matchMedia', () => {
    setMatchMedia(undefined);

    expect(() => service.canon()).not.toThrow();
    expect(confetti).toHaveBeenCalledExactlyOnceWith({
      angle: 210,
      spread: 80,
      particleCount: 100,
      origin: {x: 0, y: 0},
    });
  });
});
