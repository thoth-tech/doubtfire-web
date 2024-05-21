import { Component } from '@angular/core';

@Component({
  selector: 'tutor-group-manager',
  templateUrl: './tutor-group-manager.component.html',
  styleUrls: ['./tutor-group-manager.component.scss']
})
export class TutorGroupManagerComponent {
  unit = {
    groupSets: [] 
  };

  constructor() {

  }
}
