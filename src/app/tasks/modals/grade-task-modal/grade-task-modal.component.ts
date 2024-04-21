import { Component, OnInit, Input, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { GradeIconService } from 'src/app/common/grade-icon/grade-icon.service'; // Import GradeIconService

@Component({
  selector: 'grade-task-modal',
  templateUrl: './grade-task-modal.component.html',
  styleUrls: ['./grade-task-modal.component.scss'],
})
export class GradeTaskModalComponent implements OnInit {
  @Input() task: any;

  data: {
    desiredGrade: number;
    rating: number;
    overStar: number;
    confRating: number;
  } = { desiredGrade: 0, rating: 0, overStar: 0, confRating: 0 };

  gradeValues: number[] = [0, 1, 2, 3, 4 ];
  grades: any[];
  numStars: number;

  constructor(
    public dialogRef: MatDialogRef<GradeTaskModalComponent, any>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
    private gradeIconService: GradeIconService
  ) {}

  ngOnInit(): void {
    this.task = this.dialogData.task;
    this.data.desiredGrade = this.task.grade;
    this.data.rating = this.task.quality_pts || 1;
    this.grades = Object.values(this.gradeIconService.gradeAcronyms);    
    this.numStars = this.task.definition.max_quality_pts || 5;
  }

  close(): void {
    this.dialogRef.close({
      qualityPts: this.data.rating,
      selectedGrade: this.data.desiredGrade,
    });
  }

  hoveringOver(value: number): void {
    this.data.overStar = value;
  }

  checkClearRating(): void {
    if (
      this.data.confRating == 1 &&
      this.data.rating == 1 &&
      this.data.overStar == 1
    ) {
      this.data.rating = 0;
    } else if (
      this.data.confRating == 1 &&
      this.data.overStar == 1 &&
      this.data.rating == 0
    ) {
      this.data.rating = 1;
    }

    this.data.confRating = this.data.rating;
  }
}