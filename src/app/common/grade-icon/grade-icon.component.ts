import {Component, Input} from '@angular/core';
import {GradeService} from 'src/app/common/services/grade.service';
@Component({
  selector: 'f-grade-icon',
  templateUrl: './grade-icon.component.html',
  styleUrl: './grade-icon.component.scss',
})
export class GradeIconComponent {
  @Input() grade: string;

  constructor(private readonly gradeService: GradeService) {}

  get gradeText() {
    return this.gradeService.grades[this.grade + 1] || 'Grade';
  }

  get gradeLetter() {
    return this.gradeService.gradeAcronyms[this.grade] || 'G';
  }
}
