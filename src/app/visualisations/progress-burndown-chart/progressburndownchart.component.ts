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
  originalGaugeData: any[] = [];
  markedPercentage: number = 0;

  // Track which series are selected (only one at a time)
  selectedSeries: string | null = null;
  allSeriesVisible: boolean = true;

  // options
  legend: boolean = true;
  showLabels: boolean = true;
  animations: boolean = true;
  // Updated color scheme - Marked is now green
  colorScheme = { domain: ['#AAAAAA', '#777777', '#0079d8', '#28a745'] };

  private seriesVisibility: { [key: string]: boolean } = {};

  constructor(public viewContainerRef: ViewContainerRef) {
    super(viewContainerRef);
    this.data = [];
    this.gaugeData = [];
    this.temp = [];
    this.originalGaugeData = [];
  }

  ngOnInit(): void {
    console.log('ProgressBurndownChartComponent: ngOnInit');
    console.log(this.project);

    this.project.refreshBurndownChartData();
    this.updateData();

    // Initialize all series as visible
    this.gaugeData.forEach((item) => {
      this.seriesVisibility[item.name] = true;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('grade' in changes && changes.grade.currentValue !== undefined) {
      this.project.refreshBurndownChartData();
      this.updateData();
    }
  }

  // Add this function to fix the error
  formatGaugeValue(value: any): string {
    if (typeof value === 'number') {
      return `${value.toFixed(1)}%`;
    }
    return value;
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

    // Target grade mapping - maps grade index to percentage values
    const targetGradeMapping = {
      0: 50,  // Pass: 50%
      1: 60,  // Credit: 60%
      2: 70,  // Distinction: 70%
      3: 80   // High Distinction: 80%
    };

    // Create data for line chart (keeping original functionality)
    const formattedData = chartData.map((dataset) => {
      const values = Array(10)
        .fill(0)
        .map((_, index) => dataset.values[index] || 0);

      const series = dates.map((date, index) => {
        let value = values[index][1] ?? 0;

        // Special handling for Target Grade - apply our mapping
        if (dataset.key === 'Target Grade') {
          // If the value is close to 0, 0.33, 0.66, or 1.0, map it to our percentages
          if (value < 0.2) value = 0.5; // Pass: 50%
          else if (value < 0.5) value = 0.6; // Credit: 60%
          else if (value < 0.8) value = 0.7; // Distinction: 70%
          else value = 0.8; // High Distinction: 80%
        }

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

    // Create data for gauge chart - apply the same target grade mapping
    const gaugeFormattedData = chartData.map((dataset) => {
      // Get the latest non-zero value
      const latestValues = dataset.values.filter(v => v && Array.isArray(v) && v.length > 1);
      const latestValue = latestValues.length > 0 ?
                          latestValues[latestValues.length - 1][1] : 0;

      // Convert to percentage, with special handling for Target Grade
      let value;
      if (dataset.key === 'Target Grade') {
        // Map to our fixed percentages based on the target grade
        value = targetGradeMapping[this.project.targetGrade] || 50;
      } else {
        value = latestValue * 100;
      }

      if (value < 0) value = 0;

      return {
        name: dataset.key,
        value: value
      };
    });

    // Find the Marked data and extract its percentage
    const markedData = gaugeFormattedData.find(item => item.name === 'Marked');
    if (markedData) {
      this.markedPercentage = parseFloat(markedData.value.toFixed(1));
    }

    this.temp = JSON.parse(JSON.stringify(formattedData));
    this.data = formattedData;
    this.gaugeData = gaugeFormattedData;
    // Keep original data for toggling visibility
    this.originalGaugeData = JSON.parse(JSON.stringify(gaugeFormattedData));
  }

  // Handle legend click events for toggling series visibility - UPDATED VERSION
  onSelect(event): void {
    // Check if this is a legend click (string event)
    if (typeof event === 'string') {
      const seriesName = event;

      // If all series are currently visible and user clicks one,
      // show only that one and hide others
      if (this.allSeriesVisible) {
        // Set all series to invisible except the clicked one
        this.originalGaugeData.forEach(item => {
          this.seriesVisibility[item.name] = (item.name === seriesName);
        });
        this.allSeriesVisible = false;
        this.selectedSeries = seriesName;
      }
      // If only one series is visible and user clicks the same one again,
      // show all series
      else if (this.selectedSeries === seriesName) {
        // Set all series to visible
        this.originalGaugeData.forEach(item => {
          this.seriesVisibility[item.name] = true;
        });
        this.allSeriesVisible = true;
        this.selectedSeries = null;
      }
      // If only one series is visible and user clicks a different one,
      // show only the newly clicked one
      else {
        // Set all series to invisible except the clicked one
        this.originalGaugeData.forEach(item => {
          this.seriesVisibility[item.name] = (item.name === seriesName);
        });
        this.selectedSeries = seriesName;
      }

      // Update the gauge data based on the new visibility states
      this.gaugeData = this.originalGaugeData.map(item => {
        if (!this.seriesVisibility[item.name]) {
          return { ...item, value: 0 };
        }
        return { ...item };
      });
    }
  }

  // Check if a series is currently visible
  isSeriesVisible(seriesName: string): boolean {
    return this.seriesVisibility[seriesName];
  }

  formatPerc(input) {
    return `${input}%`;
  }
}
