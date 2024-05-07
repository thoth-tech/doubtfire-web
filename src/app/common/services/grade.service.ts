import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class GradeService {
  gradeValues: number[] = [0, 1, 2, 3];
  allGradeValues: number[] = [-1, 0, 1, 2, 3];
  grades: string[] = ['Pass', 'Credit', 'Distinction', 'High Distinction'];
  

  gradeNumbers: { [key: string]: number } = {
    F: -1,
    P: 0,
    C: 1,
    D: 2,
    HD: 3,
  };
  gradeAcronyms: { [key: string]: string } = {
    'Fail': 'F',
    'Pass': 'P',
    'Credit': 'C',
    'Distinction': 'D',
    'High Distinction': 'HD',
    '-1': 'F',
    '0': 'P',
    '1': 'C',
    '2': 'D',
    '3': 'HD',
  };

  gradeColors: { [key: string]: string } = {
    F: '#808080',
    P: '#FF0000',
    C: '#FF8000',
    D: '#0080FF',
    HD: '#80FF00',
    '-1': '#808080',
  };

  constructor() {
    this.grades[-1] = 'Fail';
    this.gradeAcronyms[-1] = 'F'
  }

  gradeFor(project: any): number {
    return this.gradeNumbers[project.targetGrade];
  }
}