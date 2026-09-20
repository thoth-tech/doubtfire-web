import {ChangeDetectionStrategy, Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';

export type DownloadDirection = 'upTo' | 'andAbove';

export interface DownloadFilterSelection {
  grade: number;
  direction: DownloadDirection;
  excludeCompleted: boolean;
}

export interface DownloadFilterDialogData {
  gradeValues: number[];
  gradeLabel: (grade: number) => string;
  initialGrade: number;
  initialDirection: DownloadDirection;
  initialExcludeCompleted: boolean;
  matchingTaskCount: (
    grade: number,
    direction: DownloadDirection,
    excludeCompleted: boolean,
  ) => number;
}

@Component({
  selector: 'f-download-filter-dialog',
  templateUrl: './download-filter-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class DownloadFilterDialogComponent {
  grade: number;
  direction: DownloadDirection;
  excludeCompleted: boolean;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DownloadFilterDialogData,
    private dialogRef: MatDialogRef<DownloadFilterDialogComponent, DownloadFilterSelection>,
  ) {
    this.grade = data.initialGrade;
    this.direction = data.initialDirection;
    this.excludeCompleted = data.initialExcludeCompleted;
  }

  get selectedGradeLabel(): string {
    return this.data.gradeLabel(this.grade);
  }

  /**
   * "This grade and above" covers the exact-grade case at the top end (selecting HD yields
   * HD-only), so the label must not read as a range that stops short of it.
   */
  get directionLabel(): string {
    return this.direction === 'andAbove'
      ? `${this.selectedGradeLabel} and above`
      : `Everything up to ${this.selectedGradeLabel}`;
  }

  get matchingTaskCount(): number {
    return this.data.matchingTaskCount(this.grade, this.direction, this.excludeCompleted);
  }

  get canConfirm(): boolean {
    return this.matchingTaskCount > 0;
  }

  confirm(): void {
    if (!this.canConfirm) {
      return;
    }

    this.dialogRef.close({
      grade: this.grade,
      direction: this.direction,
      excludeCompleted: this.excludeCompleted,
    });
  }
}
