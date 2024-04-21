import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class GradeIconService {
  grades: string[] = [
    'Fail',
    'Pass',
    'Credit',
    'Distinction',
    'High Distinction'
  ];

  gradeAcronyms: { [key: string]: string } = {
    'Fail': 'F',
    'Pass': 'P',
    'Credit': 'C',
    'Distinction': 'D',
    'High Distinction': 'HD'
  };


  constructor() {}

  getGradeText(grade: number): string {
    return this.grades[grade] || 'Grade';
  }

  getGradeLetter(grade: number): string {
    const gradeText = this.getGradeText(grade);
    return this.gradeAcronyms[gradeText] || 'G';
  }
}