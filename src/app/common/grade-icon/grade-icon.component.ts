import { Component, Input, OnInit } from '@angular/core';
import { GradeService } from './grade-icon.service';

@Component({
  selector: 'grade-icon',
  templateUrl: './grade-icon.component.html',
  styleUrls: ['./grade-icon.component.scss'],
})
export class GradeIconComponent implements OnInit {
  @Input() inputGrade: string;
  @Input() colorful?: boolean;

  grade: number | undefined;
  gradeText: (grade: number) => string | undefined;
  gradeLetter: (grade: number) => string;

  constructor(private gradeService: GradeService) {}

  ngOnInit(): void {
    this.gradeText = (grade: number) => this.gradeService.getGradeText(grade);
    this.gradeLetter = (grade: number) => this.gradeService.getGradeLetter(grade);
    this.calculateGrade();
  }

  private calculateGrade(): void {
    this.grade = this.gradeService.calculateGrade(this.inputGrade);
  }
}