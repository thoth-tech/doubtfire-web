import {ChangeDetectionStrategy, Component, OnDestroy, input, signal} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {AnimatedCheckComponent} from '../animated-check.component';
import {CelebrationParticlesComponent} from '../celebration-particles.component';

/** How the panel gets from the uploading state to the confirmation. */
export type SubmitFlowVariant = 'blur' | 'lift' | 'circle' | 'wipe' | 'collapse' | 'settle';

export type SubmitFlowPhase = 'idle' | 'uploading' | 'landed' | 'swapping' | 'done';

/** Milliseconds each variant spends between the two sets of words. */
const SWAP_MS: Record<SubmitFlowVariant, number> = {
  blur: 220,
  lift: 200,
  circle: 420,
  wipe: 260,
  collapse: 480,
  settle: 180,
};

const UPLOAD_MS = 1300;
const LANDED_MS = 600;

/**
 * One submission panel, played on demand, with the handover done a different way
 * per variant. The markup is identical across all of them: only the stylesheet
 * differs, so whichever wins can go back into the real dialog as CSS alone.
 */
@Component({
  selector: 'f-submit-flow-lab',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, AnimatedCheckComponent, CelebrationParticlesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './submit-flow-lab.component.html',
  styleUrl: './submit-flow-lab.component.scss',
  host: {
    '[attr.data-variant]': 'variant()',
  },
})
export class SubmitFlowLabComponent implements OnDestroy {
  public readonly variant = input.required<SubmitFlowVariant>();

  public readonly phase = signal<SubmitFlowPhase>('idle');
  public readonly progress = signal(0);

  private timers: ReturnType<typeof setTimeout>[] = [];
  private frame: number | null = null;

  public get done(): boolean {
    return this.phase() === 'done';
  }

  public get landed(): boolean {
    return this.phase() === 'landed' || this.phase() === 'swapping' || this.done;
  }

  public get swapping(): boolean {
    return this.phase() === 'swapping';
  }

  public get running(): boolean {
    return this.phase() !== 'idle';
  }

  public get title(): string {
    if (this.done) {
      return 'Submitted on time. Ready for feedback';
    }
    return this.landed ? 'Uploaded' : 'Uploading your work';
  }

  public get detail(): string {
    return this.done ? '3.1P Update your company mentor' : 'report.pdf';
  }

  public play(): void {
    this.reset();
    this.phase.set('uploading');

    // A real upload arrives in bursts. A smooth ramp is enough to judge the
    // handover, which is the only thing this page is for.
    const started = performance.now();
    const step = () => {
      const elapsed = performance.now() - started;
      this.progress.set(Math.min(100, Math.round((elapsed / UPLOAD_MS) * 100)));
      if (elapsed < UPLOAD_MS && this.phase() === 'uploading') {
        this.frame = requestAnimationFrame(step);
      }
    };
    this.frame = requestAnimationFrame(step);

    this.after(UPLOAD_MS, () => {
      this.progress.set(100);
      this.phase.set('landed');
    });
    this.after(UPLOAD_MS + LANDED_MS, () => this.phase.set('swapping'));
    this.after(UPLOAD_MS + LANDED_MS + SWAP_MS[this.variant()], () => this.phase.set('done'));
  }

  public reset(): void {
    this.clear();
    this.phase.set('idle');
    this.progress.set(0);
  }

  public ngOnDestroy(): void {
    this.clear();
  }

  private after(delay: number, run: () => void): void {
    this.timers.push(setTimeout(run, delay));
  }

  private clear(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }
}
