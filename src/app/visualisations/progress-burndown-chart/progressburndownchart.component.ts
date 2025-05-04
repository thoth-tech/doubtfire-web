import { Component, OnInit, Input, SimpleChanges, LOCALE_ID, ViewContainerRef } from '@angular/core';
import { Project, Unit } from 'src/app/api/models/doubtfire-model';
import { formatDate } from '@angular/common';
import { MappingFunctions } from 'src/app/api/services/mapping-fn';
import { AppInjector } from 'src/app/app-injector';
import { ChartBaseComponent } from 'src/app/common/chart-base/chart-base-component/chart-base-component.component';

@Component({
  selector: 'f-progress-burndown-chart',
  templateUrl: './progressburndownchart.component.html',
  styleUrls: ['./progressburndownchart.component.scss']
})
export class ProgressBurndownChartComponent extends ChartBaseComponent implements OnInit {
  @Input() project: Project;
  @Input() unit: Unit;
  @Input() grade: any;

  data: any[] = [];
  gaugeData: any[] = [];
  temp: any[] = [];

  // options
  legend: boolean = true;
  showLabels: boolean = true;
  animations: boolean = true;
  colorScheme = { domain: ['#AAAAAA', '#777777', '#0079d8', '#E01B5D'] };

  private seriesVisibility: { [key: string]: boolean } = {};

  constructor(public viewContainerRef: ViewContainerRef) {
    super(viewContainerRef);
    this.data = [];
    this.gaugeData = [];
    this.temp = [];
  }

  ngOnInit(): void {
    console.log('ProgressBurndownChartComponent: ngOnInit');
    console.log(this.project);

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

  generateDates() {
    const startDate: Date = this.project.unit.startDate;
    const endDate: Date = this.project.unit.endDate;
    const locale: string = AppInjector.get(LOCALE_ID);
    const numberPoints = 10;
    // Get the number of days between dates
    const totalDays =  MappingFunctions.daysBetween(startDate, endDate);
    const interval = totalDays / (numberPoints - 1); // get gaps between points

    const dates = [];
    for (let i = 0; i < numberPoints; i++) {
      const date = MappingFunctions.daysAfter(startDate, interval * i);
      dates.push(formatDate(date, 'd MMM', locale));
    }

    return dates;
  }

  updateData(): void {
    const chartData = this.project?.burndownChartData;
    const dates = this.generateDates();

    // Create data for line chart (keeping original functionality)
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

    // Create data for gauge chart
    // We take the latest value from each series
    const gaugeFormattedData = chartData.map((dataset) => {
      // Get the latest non-zero value
      // Fix for the TypeScript error
      const latestValues = dataset.values.filter(v => v && Array.isArray(v) && v.length > 1);
      const latestValue = latestValues.length > 0 ?
                          latestValues[latestValues.length - 1][1] : 0;

      // Convert to percentage
      let value = latestValue * 100;
      if (value < 0) value = 0;

      // Format name for display
      let name = dataset.key;
      if (name === 'To Submit') name = 'ToSubmit';
      if (name === 'To Complete') name = 'ToComplete';

      return {
        name: name,
        value: value
      };
    });

    this.temp = JSON.parse(JSON.stringify(formattedData));
    this.data = formattedData;
    this.gaugeData = gaugeFormattedData;
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
