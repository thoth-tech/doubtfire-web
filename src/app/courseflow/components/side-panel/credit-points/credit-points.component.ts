import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-credit-points',
  templateUrl: './credit-points.component.html',
  styleUrls: ['./credit-points.component.css']
})
export class CreditPointsComponent {
  @Input() achieved: number;
  @Input() total: number;
}
