import { Component, OnInit, Input, SimpleChanges } from '@angular/core';
import * as moment from 'moment';

@Component({
  selector: 'app-progress-burndown-chart',
  templateUrl: './progressburndownchart.component.html',
  styleUrls: ['./progressburndownchart.component.scss']
})

export class ProgressBurndownChartComponent implements OnInit {
  @Input() project: any;
  @Input() unit: any;
  @Input() grade: any;

  data: any[] = [];
  temp: any[] = [];

  // options
  legend: boolean = true;
  showLabels: boolean = true;
  animations: boolean = true;
  xAxis: boolean = true;
  yAxis: boolean = true;
  showYAxisLabel: boolean = true;
  showXAxisLabel: boolean = true;
  xAxisLabel: string = 'Time';
  yAxisLabel: string = 'Tasks Remaining';
  colorScheme = { domain: ['#AAAAAA', '#777777', '#0079d8', '#E01B5D'] };

  private seriesVisibility: { [key: string]: boolean } = {};

  constructor() {
    this.data = [];
    this.temp = [];
  }

  ngOnInit(): void {
    this.project.refreshBurndownChartData();
    this.updateData();
    this.data.forEach((item) => {
      this.seriesVisibility[item.name] = true;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('grade' in changes && changes.grade.currentValue !== undefined) {
      this.project.refreshBurndownChartData();
      this.updateData();
    }
  }

  generateDates(startDate, endDate) {
    const start = moment(startDate);
    const end = moment(endDate);
    const totalDays = end.diff(start, 'days');
    const interval = totalDays / 9;

    const dates = [];
    for (let i = 0; i <= 9; i++) {
      const date = moment(start).add(interval * i, 'days');
      dates.push(date.format('D MMM'));
    }

    return dates;
  }

  updateData(): void {
    const chartData = this.project?.burndownChartData;

    const startDate = new Date(this.unit.startDate).getTime();
    const endDate = new Date(this.unit.endDate).getTime();
    const dates = this.generateDates(startDate, endDate);

    const formattedData = chartData.map((dataset) => {
      const values = Array(10)
        .fill(0)
        .map((_, index) => dataset.values[index] || 0);

      const series = dates.map((date, index) => {
        let value = values[index][1] ?? 0;
        value = value * 100;

        if (value < 0) {
          value = 0;
        }

        return { name: date, value };
      });

      return {
        name: dataset.key,
        series,
      };
    });

    this.temp = JSON.parse(JSON.stringify(formattedData));
    this.data = formattedData;
  }

  onSelect(event): void {
    if (this.isLegend(event)) {
      const tempData = JSON.parse(JSON.stringify(this.data));
      if (this.isDataShown(event)) {
        tempData.forEach((series) => {
          if (series.name === event) {
            series.series.forEach((point) => (point.value = 0));
          }
        });
      } else {
        const originalSeries = this.temp.find((series) => series.name === event);
        const seriesIndex = tempData.findIndex((series) => series.name === event);
        if (seriesIndex >= 0) {
          tempData[seriesIndex] = JSON.parse(JSON.stringify(originalSeries));
        }
      }
      this.data = tempData;
    }
  }

  isLegend(event: any): boolean {
    return typeof event === 'string';
  }

  isDataShown(name: string): boolean {
    const series = this.data.find((series) => series.name === name);
    return series && series.series.some((point) => point.value !== 0);
  }

  public formatPerc(input) {
    return `${input}%`;
  }
}
