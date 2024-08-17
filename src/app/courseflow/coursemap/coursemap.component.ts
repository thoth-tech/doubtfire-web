import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatListModule} from '@angular/material/list';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {CdkDragDrop, moveItemInArray, transferArrayItem} from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'coursemap',
  templateUrl: './coursemap.component.html',
  styleUrls: ['./coursemap.component.scss'],
  standalone: true,
  imports: [CommonModule, MatListModule, DragDropModule, MatIconModule],
})
export class CoursemapComponent {
  requiredUnits = ['SIT1', 'SIT2', 'SIT3', 'SIT4', 'SIT5', 'SIT6'];

  years = [
    {
      year: 2023,
      trimester1: ['Course 1', 'Course 2'],
      trimester2: ['Course 3', 'Course 4'],
      trimester3: ['Course 5', 'Course 6'],
    },
  ];

  allTrimesters = [this.years[0].trimester1, this.years[0].trimester2, this.years[0].trimester3];

  get connectedDropLists(): string[] {
    const dropListIds: string[] = ['requiredUnits'];
    this.years.forEach((_, i) => {
      dropListIds.push(`trimester1-${i}`, `trimester2-${i}`, `trimester3-${i}`);
    });
    return dropListIds;
  }

  addYear() {
    const nextYear = this.years.length > 0 ? this.years[this.years.length - 1].year + 1 : new Date().getFullYear();
    const newYear = {
      year: nextYear,
      trimester1: [],
      trimester2: [],
      trimester3: [],
    };
    this.years.push(newYear);
  }

  deleteYear(index: number) {
    this.years.splice(index, 1);
  }

  deleteTrimester(yearIndex: number, trimesterIndex: number) {
    const trimesters = ['trimester1', 'trimester2', 'trimester3'];
    const trimesterToDelete = this.years[yearIndex][trimesters[trimesterIndex]];

    // Move all units from the trimester to the requiredUnits array
    this.requiredUnits.push(...trimesterToDelete);

    // Set the trimester to null to remove it
    this.years[yearIndex][trimesters[trimesterIndex]] = null;
  }

  addTrimester(yearIndex: number) {
    const year = this.years[yearIndex];

    if (!year.trimester1) {
      year.trimester1 = [];
    } else if (!year.trimester2) {
      year.trimester2 = [];
    } else if (!year.trimester3) {
      year.trimester3 = [];
    } else {
      // Optional: Alert or handle the case where all three trimesters already exist
      console.log('All three trimesters already exist.');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  countTrimesters(year: any): number {
    let trimesterCount = 0;
    if (year.trimester1 && year.trimester1.length > 0) trimesterCount++;
    if (year.trimester2 && year.trimester2.length > 0) trimesterCount++;
    if (year.trimester3 && year.trimester3.length > 0) trimesterCount++;
    return trimesterCount;
  }

  constructor() {}

  drop(event: CdkDragDrop<string[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }
  }
}
