import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Project } from 'src/app/api/models/doubtfire-model';

@Component({
  selector: 'app-grade-gauge',
  standalone: true,
  templateUrl: './grade-gauge.component.html',
  styleUrls: ['./grade-gauge.component.css']
})
export class GradeGaugeComponent implements OnChanges {
  @Input() project!: Project;

  gaugeData: { name: string; value: number }[] = [];
  colorScheme = 'cool';
  legendColors = ['#aa835d', '#7a3ae5', '#a2e7a8', '#aae3f5'];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['project'] && this.project?.burndownChartData) {
      this.updateGaugeData();
    }
  }

  updateGaugeData(): void {
    const chartData = this.project.burndownChartData || [];

    const getLatestValue = (key: string): number => {
      const dataSet = chartData.find((d) => d.key?.toLowerCase() === key.toLowerCase());
      const lastEntry = dataSet?.values?.[dataSet.values.length - 1];
      const rawValue = Array.isArray(lastEntry) ? lastEntry[1] : 0;
      return rawValue !== undefined ? Math.max(rawValue * 100, 0) : 0;
    };

    this.gaugeData = [
      { name: 'Target Grade', value: getLatestValue('target') },
      { name: 'Estimated', value: getLatestValue('projected') },
      { name: 'Submitted', value: getLatestValue('toSubmit') },
      { name: 'Marked', value: getLatestValue('toComplete') }
    ];
  }
}