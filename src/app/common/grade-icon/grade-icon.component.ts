import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { GradeService } from './grade-icon.service';

@Component({
  selector: 'grade-icon',
  templateUrl: './grade-icon.component.html',
  styleUrls: ['./grade-icon.component.scss'] 
})
export class GradeIconComponent implements OnChanges {
  @Input() inputGrade: string | number;
  @Input() colorful: boolean = false;

  grade: number;
  gradeText: string;
  gradeLetter: string;

  constructor(private gradeService: GradeService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.inputGrade) {
      this.grade = typeof this.inputGrade === 'string' ?
        this.gradeService.grades.indexOf(this.inputGrade) :
        this.inputGrade;
      this.gradeText = this.gradeService.getGradeText(this.grade);
      this.gradeLetter = this.gradeService.getGradeLetter(this.gradeText);
      console.log(this.gradeService.getGradeLetter(this.gradeText));
    }
  }
}