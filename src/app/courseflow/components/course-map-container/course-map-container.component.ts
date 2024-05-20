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
  selector: 'app-course-map-container',
  templateUrl: './course-map-container.component.html',
  styleUrls: ['./course-map-container.component.css']
})
export class CourseMapContainerComponent {
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
