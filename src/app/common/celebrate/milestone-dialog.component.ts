import {ChangeDetectionStrategy, Component, ViewEncapsulation, inject} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {AnimatedCheckComponent} from './animated-check.component';
import {CelebrationParticlesComponent} from './celebration-particles.component';
import {prefersReducedMotion} from './reduced-motion';

export interface MilestoneTaskRow {
  taskDefinitionId: number;
  abbreviation: string;
  name: string;
  grade?: string;
  stars?: {earned: number; max: number};
}

export interface MilestoneChangeRow {
  taskDefinitionId: number;
  abbreviation: string;
  name: string;
  label: string;
}

export interface MilestoneDialogData {
  unitCode: string;
  completed: MilestoneTaskRow[];
  alsoChanged: MilestoneChangeRow[];
  /** Whole percentages, 0 to 100. */
  progressFrom: number;
  progressTo: number;
  targetGradeLabel?: string;
}

export type MilestoneDialogResult = 'view' | 'close';

/** Rows after this one share its delay, so a long list still settles quickly. */
const MAX_STAGGERED_ROWS = 8;
const FIRST_ROW_DELAY_MS = 180;
const ROW_STAGGER_MS = 50;

@Component({
  selector: 'f-milestone-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    AnimatedCheckComponent,
    CelebrationParticlesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog surface lives outside this component, and its entrance is tuned
  // here. Every selector is scoped under .ot-milestone so nothing leaks.
  encapsulation: ViewEncapsulation.None,
  templateUrl: './milestone-dialog.component.html',
  styleUrl: './milestone-dialog.component.scss',
})
export class MilestoneDialogComponent {
  public readonly data = inject<MilestoneDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<MilestoneDialogComponent, MilestoneDialogResult>>(MatDialogRef);

  public readonly reducedMotion = prefersReducedMotion();

  public get heading(): string {
    const count = this.data.completed.length;
    return `${count} ${count === 1 ? 'task' : 'tasks'} signed off`;
  }

  public get progressFrom(): number {
    return this.clampPercent(this.data.progressFrom);
  }

  public get progressTo(): number {
    return this.clampPercent(this.data.progressTo);
  }

  public get progressLabel(): string {
    return this.data.targetGradeLabel
      ? `Progress toward ${this.data.targetGradeLabel}`
      : 'Progress this unit';
  }

  public rowDelay(index: number): number {
    return FIRST_ROW_DELAY_MS + Math.min(index, MAX_STAGGERED_ROWS) * ROW_STAGGER_MS;
  }

  public close(result: MilestoneDialogResult): void {
    this.dialogRef.close(result);
  }

  private clampPercent(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
  }
}
