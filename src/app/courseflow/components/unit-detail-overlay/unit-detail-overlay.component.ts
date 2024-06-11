import { Component, Input } from '@angular/core';

interface UnitDetail {
  name: string;
  requirements: string;
  progress: string;
}

@Component({
  selector: 'app-unit-detail-overlay',
  templateUrl: './unit-detail-overlay.component.html',
  styleUrls: ['./unit-detail-overlay.component.css']
})
export class UnitDetailOverlayComponent {
  @Input() unit: UnitDetail;
}
