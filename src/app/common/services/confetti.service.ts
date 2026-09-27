import confetti from 'canvas-confetti';
import {Injectable, InjectionToken, inject} from '@angular/core';

export const CONFETTI: InjectionToken<typeof confetti> = new InjectionToken('Confetti', {
  providedIn: 'root',
  factory: () => confetti,
});

@Injectable({
  providedIn: 'root',
})
export class ConfettiService {
  private readonly launch = inject(CONFETTI);

  /**
   * `options.zIndex` matters over a dialog: the canvas is appended to the body at
   * z-index 100 by default, which is under the CDK overlay, so confetti fired
   * from inside a dialog lands behind it.
   */
  public canon(
    x: number = 0,
    y: number = 0,
    angle = 210,
    options: {zIndex?: number; particleCount?: number; spread?: number; scalar?: number} = {},
  ): void {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    this.launch({
      angle: angle,
      spread: options.spread ?? 80,
      particleCount: options.particleCount ?? 100,
      origin: {y: y, x: x},
      ...(options.zIndex === undefined ? {} : {zIndex: options.zIndex}),
      ...(options.scalar === undefined ? {} : {scalar: options.scalar}),
    });
  }
}
