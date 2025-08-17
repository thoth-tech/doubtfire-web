import {Component, Inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatDialogModule, MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {CourseUnit} from '../../models/course-map.models';

interface SkillsSummaryData {
  units: CourseUnit[];
}

@Component({
  selector: 'skills-summary-dialog',
  templateUrl: './skills-summary-dialog.component.html',
  styleUrls: ['./skills-summary-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
})
export class SkillsSummaryDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<SkillsSummaryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SkillsSummaryData,
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }

  getCompletedUnits(): CourseUnit[] {
    return this.data.units.filter(unit => {
      const unitWithCompletion = unit as CourseUnit & {isCompleted?: boolean};
      return unitWithCompletion.isCompleted;
    });
  }

  getInProgressUnits(): CourseUnit[] {
    return this.data.units.filter(unit => {
      const unitWithCompletion = unit as CourseUnit & {isCompleted?: boolean};
      return !unitWithCompletion.isCompleted;
    });
  }

  getAllPlacedUnits(): CourseUnit[] {
    return this.data.units.filter(unit => unit !== null);
  }
}
