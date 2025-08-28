import { Component, Input } from '@angular/core';

@Component({
  selector: 'dashboard-charts',
  templateUrl: './dashboard-charts.component.html',
  styleUrls: ['./dashboard-charts.component.scss'],
})
export class DashboardChartsComponent {
  @Input() data: any[] = []; // This fixes the error!
}
