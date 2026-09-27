import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {prefersReducedMotion} from './reduced-motion';

interface Particle {
  angle: number;
  distance: number;
  size: number;
  colour: string;
  delay: number;
}

const PARTICLE_COLOURS = [
  'var(--ot-color-success)',
  'var(--ot-color-primary)',
  'var(--ot-color-warning)',
  'var(--ot-color-info)',
];

/**
 * A single light burst of small dots, played once. Each dot is one element moved
 * with a transform, so it stays on the compositor. Nothing renders when the
 * viewer prefers reduced motion.
 */
@Component({
  selector: 'f-celebration-particles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './celebration-particles.component.html',
  styleUrl: './celebration-particles.component.scss',
  host: {
    'aria-hidden': 'true',
    '[style.--burst-delay]': 'delay() + "ms"',
  },
})
export class CelebrationParticlesComponent {
  public readonly count = input(12);
  /** How far, in pixels, the furthest dot travels from the centre. */
  public readonly spread = input(56);
  public readonly delay = input(0);

  public readonly reducedMotion = prefersReducedMotion();

  protected readonly particles = computed<Particle[]>(() => {
    const count = Math.max(0, Math.min(24, Math.round(this.count())));
    const spread = this.spread();

    // Evenly spaced with a fixed jitter pattern, so the burst looks organic but
    // renders the same way every time and never depends on Math.random.
    return Array.from({length: count}, (_, index) => ({
      angle: (360 / Math.max(1, count)) * index + (index % 2 === 0 ? 6 : -4),
      distance: spread * (index % 3 === 0 ? 1 : index % 3 === 1 ? 0.78 : 0.62),
      size: index % 4 === 0 ? 6 : 4,
      colour: PARTICLE_COLOURS[index % PARTICLE_COLOURS.length],
      delay: (index % 3) * 20,
    }));
  });
}
