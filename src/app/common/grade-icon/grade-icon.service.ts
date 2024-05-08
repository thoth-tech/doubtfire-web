import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GradeService {
  gradeValues: number[] = [0, 1, 2, 3];
  grades: string[] = ['Fail', 'Pass', 'Credit', 'Distinction', 'High Distinction'];

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

  getGradeLetter(gradeText: string): string {
    return this.gradeAcronyms[gradeText] || 'G';
  }
}