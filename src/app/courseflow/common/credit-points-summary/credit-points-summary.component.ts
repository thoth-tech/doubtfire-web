import {Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';

@Component({
  selector: 'credit-points-summary',
  templateUrl: './credit-points-summary.component.html',
  styleUrls: ['./credit-points-summary.component.scss'],
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
})
export class CreditPointsSummaryComponent {
  @Input() currentPoints: number = 0;
  @Input() totalPoints: number = 24;
  @Input() showIcon: boolean = true;
  @Input() variant: 'default' | 'compact' | 'header' = 'default';

  get progressPercentage(): number {
    return this.totalPoints > 0 ? Math.round((this.currentPoints / this.totalPoints) * 100) : 0;
  }

  get remainingPoints(): number {
    return Math.max(0, this.totalPoints - this.currentPoints);
  }

  get isComplete(): boolean {
    return this.currentPoints >= this.totalPoints;
  }

  get isOverloaded(): boolean {
    return this.currentPoints > this.totalPoints;
  }

  get statusClass(): string {
    if (this.isOverloaded) return 'overloaded';
    if (this.isComplete) return 'complete';
    const percentage = this.progressPercentage;
    if (percentage >= 75) return 'on-track';
    if (percentage >= 50) return 'moderate';
    return 'early';
  }

  get tooltipText(): string {
    if (this.isOverloaded) {
      return `Overloaded by ${this.currentPoints - this.totalPoints} credit points`;
    }
    if (this.isComplete) {
      return 'Course requirements completed';
    }
    return `${this.remainingPoints} credit points remaining`;
  }
}
