import { Component, OnInit, Input, SimpleChanges, ViewContainerRef } from '@angular/core';
import { Project } from 'src/app/api/models/doubtfire-model';
import { ChartBaseComponent } from 'src/app/common/chart-base/chart-base-component/chart-base-component.component';

@Component({
  selector: 'f-progress-gauge-chart',
  templateUrl: './progress-gauge-chart.component.html',
  styleUrls: ['./progress-gauge-chart.component.scss']
})
export class ProgressGaugeChartComponent extends ChartBaseComponent implements OnInit {
  @Input() project: Project;
  @Input() grade: any;

  data: any[] = [];
  
  // options
  view: [number, number] = [700, 400];
  legend: boolean = true;
  legendTitle: string = 'Progress Legend';
  legendPosition: string = 'below';
  
  colorScheme = {
    domain: ['#AAAAAA', '#777777', '#0079d8', '#E01B5D']
  };
  
  showText: boolean = true;
  gaugeMin: number = 0;
  gaugeMax: number = 100;
  gaugeUnits: string = '%';
  gaugeAngleSpan: number = 240;
  gaugeStartAngle: number = -120;
  gaugeShowAxis: boolean = true;
  gaugeLargeSegments: number = 10;
  gaugeSmallSegments: number = 5;
  marginTop: number = 20;

  constructor(public viewContainerRef: ViewContainerRef) {
    super(viewContainerRef);
  }

  ngOnInit(): void {
    this.updateData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('grade' in changes && changes.grade.currentValue !== undefined) {
      this.updateData();
    }
  }

  updateData(): void {
    if (!this.project || !this.project.burndownChartData) {
      return;
    }
    
    this.project.refreshBurndownChartData();
    const chartData = this.project.burndownChartData;
    
    // Extract the latest values from each dataset
    const data = [];
    
    // Map the burndown chart data to gauge format
    chartData.forEach(dataset => {
      // Get the last non-zero value from each dataset
      const values = dataset.values;
      let lastValue = 0;
      
      for (let i = values.length - 1; i >= 0; i--) {
        if (values[i] && values[i][1] !== undefined) {
          lastValue = values[i][1] * 100; // Convert to percentage
          break;
        }
      }
      
      // Ensure values are within bounds
      lastValue = Math.max(0, Math.min(100, lastValue));
      
      data.push({
        name: dataset.key,
        value: lastValue
      });
    });
    
    this.data = data;
  }

  formatPerc(value: number): string {
    return `${Math.round(value)}%`;
  }

  onSelect(event): void {
    console.log(event);
  }
}