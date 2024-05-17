import {AfterViewInit, Component, Inject} from '@angular/core';
import {MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import {GradeService} from 'src/app/common/services/grade.service';
import {Task} from 'src/app/api/models/task';

@Component({
  selector: 'f-grade-task-modal',
  templateUrl: './grade-task-modal.component.html',
  styleUrl: './grade-task-modal.component.scss',
})
export class GradeTaskModalComponent {

  data: {
    desiredGrade: number;
    rating: number;
    overStar: number;
    confRating: number;
  };

  numStars: number;
  gradeValues: number[];
  grades: string[];
  task: Task;

  constructor(
    public dialogRef: MatDialogRef<GradeTaskModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: {task: Task},
    private gradeService: GradeService,
  ) {

    this.task = dialogData.task;

    this.data = {
      desiredGrade: dialogData.task.grade,
      rating:
        !dialogData?.task?.qualityPts || dialogData.task.qualityPts < 0
          ? 0
          : dialogData.task.qualityPts,
      overStar: 0,
      confRating: 0,
    };

    this.numStars = dialogData.task.definition.maxQualityPts || 5;
    this.gradeValues = this.gradeService.allGradeValues;
    this.grades = this.gradeService.grades;
  }


  // Method to handle the dialog close with data
  close(): void {
    this.dialogRef.close({
      qualityPts: this.data.rating,
      selectedGrade: this.data.desiredGrade,
    });
  }

  // Method to handle the dialog close without returning any data
  dismiss(): void {
    this.dialogRef.close();
  }

  // Method to update hover state
  hoveringOver(value: number): void {
    this.data.overStar = value;
  }

  // Logic to handle clearing or setting the rating based on hover interactions
  checkClearRating(event: any): void {
    this.data.rating = event;
    if (this.data.confRating === 1 && this.data.rating === 1 && this.data.overStar === 1) {
      this.data.rating = 0;
    } else if (this.data.confRating === 1 && this.data.overStar === 1 && this.data.rating === 0) {
      this.data.rating = 1;
    }
    this.data.confRating = this.data.rating;
  }
}
