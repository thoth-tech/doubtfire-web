import { Component } from '@angular/core';

interface Unit {
  name: string;
  draggable: boolean;
}

interface Trimester {
  name: string;
  units: Unit[];
}

interface Year {
  name: string;
  trimesters: Trimester[];
}

@Component({
  selector: 'app-courseflow',
  templateUrl: './courseflow.component.html',
  styleUrls: ['./courseflow.component.css']
})
export class CourseflowComponent {
  courseName = "Sample Course Name";
  creditPointsAchieved = 5;
  totalCreditPoints = 24;
  coreUnits: Unit[] = [
    { name: "Core Unit 1", draggable: true },
    { name: "Core Unit 2", draggable: true },
    { name: "Core Unit 3", draggable: true }
  ];
  electiveUnits: Unit[] = [
    { name: "Elective Unit 1", draggable: true },
    { name: "Elective Unit 2", draggable: true },
    { name: "Elective Unit 3", draggable: true }
  ];
  years: Year[] = [
    { name: "Year 1", trimesters: [{ name: "Trimester 1", units: [] }, { name: "Trimester 2", units: [] }] },
    { name: "Year 2", trimesters: [{ name: "Trimester 1", units: [] }, { name: "Trimester 2", units: [] }] }
  ];

  addUnitToTrimester(yearIndex: number, trimesterIndex: number, unitName: string) {
    const newUnit: Unit = { name: unitName, draggable: true };
    this.years[yearIndex].trimesters[trimesterIndex].units.push(newUnit);
  }

  removeUnitFromTrimester(yearIndex: number, trimesterIndex: number, unitIndex: number) {
    this.years[yearIndex].trimesters[trimesterIndex].units.splice(unitIndex, 1);
  }
}
