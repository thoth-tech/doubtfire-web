import { Component, Input } from '@angular/core';
import { GradeIconService } from './grade-icon.service';

@Component({
  selector: 'grade-icon',
  templateUrl: './grade-icon.component.html',
  styleUrls: ['./grade-icon.component.scss']
})

export class GradeIconComponent {
  @Input() grade: number;
  @Input() colorful: boolean;
  @Input() tooltip: string;

  constructor(private gradeIconService: GradeIconService) {}

  gradeText(grade: number): string {
    return this.gradeIconService.getGradeText(grade);
  }

  gradeLetter(grade: number): string {
    return this.gradeIconService.getGradeLetter(grade);
  }
}