import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {prefersReducedMotion} from './reduced-motion';

export type CelebrateTone = 'success' | 'primary' | 'neutral';

/**
 * A ring that draws itself, then a tick that draws inside it. Purely decorative,
 * so it is hidden from assistive technology and the host announces the meaning.
 */
@Component({
  selector: 'f-animated-check',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './animated-check.component.html',
  styleUrl: './animated-check.component.scss',
  host: {
    'class': 'f-animated-check',
    '[class.tone-success]': "tone() === 'success'",
    '[class.tone-primary]': "tone() === 'primary'",
    '[class.tone-neutral]': "tone() === 'neutral'",
    '[class.reduced-motion]': 'reducedMotion',
    '[style.--check-delay]': 'delayCss()',
    '[style.--check-pace]': 'pace()',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
})
export class AnimatedCheckComponent {
  public readonly size = input(40);
  public readonly tone = input<CelebrateTone>('success');
  /** Milliseconds to wait before the ring starts drawing. */
  public readonly delay = input(0);
  /** Multiplies every duration in the draw. Above 1 draws more slowly. */
  public readonly pace = input(1);

  /** Read once. A viewer who wants less motion gets the finished tick with a quick fade. */
  public readonly reducedMotion = prefersReducedMotion();

  protected readonly delayCss = computed(() => `${Math.max(0, this.delay())}ms`);
  protected readonly strokeWidth = computed(() => (this.size() <= 20 ? 5 : 3.5));
}
