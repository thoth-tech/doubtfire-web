import { Component } from '@angular/core';

interface Unit {
  name: string;
  draggable: boolean;
}

@Component({
  selector: 'app-side-panel',
  templateUrl: './side-panel.component.html',
  styleUrls: ['./side-panel.component.css']
})
export class SidePanelComponent {
  courseName = "Course Name";
  creditPointsAchieved = 1;
  totalCreditPoints = 24;
  coreUnits: Unit[] = [
    { name: "Core Unit 1", draggable: true },
    { name: "Core Unit 2", draggable: true }
  ];
  electiveUnits: Unit[] = [
    { name: "Elective Unit 1", draggable: true },
    { name: "Elective Unit 2", draggable: true }
  ];
}
