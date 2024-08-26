import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { GradeService } from 'src/app/common/services/grade.service';

@Component({
  selector: 'app-grade-task-modal',
  templateUrl: './grade-task-modal.component.html',
  styleUrls: ['./grade-task-modal.component.scss']
})
export class GradeTaskModalComponent implements OnInit {
  task: any;
  data: any;
  gradeValues: any;
  grades: any;
  numStars: number;

  constructor(
    public dialogRef: MatDialogRef<GradeTaskModalComponent>,
    @Inject(MAT_DIALOG_DATA) public modalData: any,
    private gradeService: GradeService // Inject GradeService
  ) {
    this.task = modalData.task;
  }

  ngOnInit(): void {
    this.data = { desiredGrade: this.task.grade, rating: this.task.qualityPts || 1, overStar: 0, confRating: 0 };
    this.gradeValues = this.gradeService.allGradeValues;
    this.grades = this.gradeService.grades;
    this.numStars = this.task.definition.maxQualityPts || 5;
  }

  close(): void {
    this.dialogRef.close({ qualityPts: this.data.rating, selectedGrade: this.data.desiredGrade });
  }

  dismiss(): void {
    this.dialogRef.close();
  }

  hoveringOver(value: number): void {
    this.data.overStar = value;
  }

  checkClearRating(): void {
    if (this.data.confRating == 1 && this.data.rating == 1 && this.data.overStar == 1) {
      this.data.rating = 0;
    } else if (this.data.confRating == 1 && this.data.overStar == 1 && this.data.rating == 0) {
      this.data.rating = 1;
    }
    this.data.confRating = this.data.rating;
  }
}
