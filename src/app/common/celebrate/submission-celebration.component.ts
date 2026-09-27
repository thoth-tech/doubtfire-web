import {ChangeDetectionStrategy, Component, input, output, signal} from '@angular/core';
import {AnimatedCheckComponent} from './animated-check.component';
import {CelebrationParticlesComponent} from './celebration-particles.component';
import {prefersReducedMotion} from './reduced-motion';
import type {SubmissionCelebration} from './submission-timing';

/** Exit length in ms. The service waits this long before removing the overlay. */
export const SUBMISSION_CELEBRATION_EXIT_MS = 150;

/**
 * The short confirmation shown after a task moves to Ready for Feedback. It sits
 * at the bottom of the screen without a backdrop, so the page stays usable while
 * it plays. The service announces the text, so this element is not a live region.
 */
@Component({
  selector: 'f-submission-celebration',
  standalone: true,
  imports: [AnimatedCheckComponent, CelebrationParticlesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './submission-celebration.component.html',
  styleUrl: './submission-celebration.component.scss',
  host: {
    '[class.leaving]': 'leaving()',
    '[class.reduced-motion]': 'reducedMotion',
  },
})
export class SubmissionCelebrationComponent {
  public readonly celebration = input<SubmissionCelebration | null>(null);
  public readonly dismiss = output<void>();

  public readonly reducedMotion = prefersReducedMotion();
  public readonly leaving = signal(false);

  public leave(): void {
    this.leaving.set(true);
  }
}
