import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GradeService {
  grades: string[] = ['A', 'B', 'C', 'D', 'E'];
  gradeAcronyms: { [key: string]: string } = { 
    'F': 'Fail',
    'P': 'Pass',
    'C': 'Credit',
    'D': 'Distinction',
    'HD': 'High Distinction'
  };

  constructor() {}

  calculateGrade(inputGrade: string | number): number | undefined {
    if (typeof inputGrade === 'string') {
      return this.grades.indexOf(inputGrade);
    } else {
      return inputGrade;
    }
  }

  getGradeText(grade: number): string {
    return this.grades[grade] || 'Grade';
  }

  getGradeLetter(grade: number): string {
    const gradeText = this.getGradeText(grade);
    return this.gradeAcronyms[gradeText] || 'G';
  }
}