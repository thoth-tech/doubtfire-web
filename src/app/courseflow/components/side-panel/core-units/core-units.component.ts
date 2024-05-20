import { Component, Input } from '@angular/core';

interface Unit {
  name: string;
  draggable: boolean;
}

@Component({
  selector: 'app-core-units',
  templateUrl: './core-units.component.html',
  styleUrls: ['./core-units.component.css']
})
export class CoreUnitsComponent {
  @Input() units: Unit[];
}
