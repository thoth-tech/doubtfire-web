import { Component } from '@angular/core';

@Component({
  selector: 'tutor-group-manager',
  templateUrl: './tutor-group-manager.component.html',
  styleUrls: ['./tutor-group-manager.component.scss']
})
export class TutorGroupManagerComponent {
  unit = {
    groupSets: [] // Assuming this structure, you'll need to populate this appropriately
  };

  constructor() {
    // Add any necessary constructor code here

  }
}
