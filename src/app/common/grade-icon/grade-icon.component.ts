import { Component, Input, Inject, OnInit, SimpleChanges } from '@angular/core';
import { gradeService } from 'src/app/ajs-upgraded-providers';
import * as _ from 'lodash';

@Component({
  selector: 'grade-icon',
  templateUrl: './grade-icon.component.html',
  styleUrls: ['./grade-icon.component.scss'],
})

export class GradeIconComponent implements  OnInit {

  @Input() index: number;
  grade: string = 'F';

  constructor(@Inject(gradeService) private gradeService: any) { }

  ngOnInit(): void {

    if (this.index == undefined)
      this.index = this.gradeService.grades.indexOf(this.grade)     
    }  
  
  gradeText(): string {
    
    if (this.grade != null)
      return this.gradeService.grades[this.index] || "Grade"
  }
  gradeLetter(): string {
      return this.gradeService.gradeAcronyms[this.gradeText()] || 'G'
  }
}