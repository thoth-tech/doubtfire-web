import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {ConfettiService} from '../services/confetti.service';
import {AnimatedCheckComponent} from './animated-check.component';
import {CelebrationParticlesComponent} from './celebration-particles.component';
import {prefersReducedMotion} from './reduced-motion';

/** Fired once the mark has drawn, so the two do not arrive on the same beat. */
const CONFETTI_DELAYS_MS = [1400, 1720, 2100];

/** Above the CDK overlay, or the confetti falls behind the dialog. */
const CONFETTI_Z_INDEX = 1200;

export interface PortfolioCelebrationFact {
  icon: string;
  label: string;
  value: string;
}

export interface PortfolioCelebrationData {
  unitCode: string;
  unitName?: string;
  headline: string;
  detail: string;
  facts: PortfolioCelebrationFact[];
  /** What happens between pressing the button and the document existing. */
  next: string;
}

/**
 * The end of a whole unit's work. A student reaches this once per unit per
 * trimester, which is rarer than anything else the app celebrates, so it is the
 * one moment allowed to take its time and to wait for the person rather than
 * timing itself out. Nothing here dismisses on its own.
 */
@Component({
  selector: 'f-portfolio-celebration',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    AnimatedCheckComponent,
    CelebrationParticlesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog surface is styled from here, every selector under .ot-portfolio
  // so nothing leaks out of it.
  encapsulation: ViewEncapsulation.None,
  templateUrl: './portfolio-celebration.component.html',
  styleUrl: './portfolio-celebration.component.scss',
})
export class PortfolioCelebrationComponent implements OnInit, OnDestroy {
  public readonly data = inject<PortfolioCelebrationData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<PortfolioCelebrationComponent>>(MatDialogRef);
  private readonly confetti = inject(ConfettiService);

  public readonly reducedMotion = prefersReducedMotion();

  private timers: ReturnType<typeof setTimeout>[] = [];

  public ngOnInit(): void {
    if (this.reducedMotion) {
      return;
    }

    // Two cannons from the lower corners, then one overhead. Fired on a timer
    // rather than all at once, so it falls through the dialog rather than
    // flashing behind it.
    const over = {zIndex: CONFETTI_Z_INDEX};
    this.fire(CONFETTI_DELAYS_MS[0], () =>
      this.confetti.canon(0.05, 0.95, 60, {...over, particleCount: 120, spread: 70}),
    );
    this.fire(CONFETTI_DELAYS_MS[1], () =>
      this.confetti.canon(0.95, 0.95, 120, {...over, particleCount: 120, spread: 70}),
    );
    this.fire(CONFETTI_DELAYS_MS[2], () =>
      this.confetti.canon(0.5, 0.28, 270, {...over, particleCount: 90, spread: 110, scalar: 0.9}),
    );
  }

  public ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  private fire(delay: number, shot: () => void): void {
    this.timers.push(
      setTimeout(() => {
        try {
          shot();
        } catch {
          // Confetti is decoration. It never takes the dialog down with it.
        }
      }, delay),
    );
  }

  /** Rows settle in one after another. Held to a handful, so it stays a beat. */
  public factDelay(index: number): string {
    return this.reducedMotion ? '0ms' : `${1500 + Math.min(index, 4) * 140}ms`;
  }

  public close(): void {
    this.dialogRef.close();
  }
}
