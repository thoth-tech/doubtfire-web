import { Component, Input } from '@angular/core';

interface Unit {
  name: string;
  draggable: boolean;
}

@Component({
  selector: 'app-elective-units',
  templateUrl: './elective-units.component.html',
  styleUrls: ['./elective-units.component.css']
})
export class ElectiveUnitsComponent {
  @Input() units: Unit[];
}
