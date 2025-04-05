import {Component, Input, OnInit,OnDestroy,AfterViewInit,ElementRef,ViewChild} from '@angular/core';
// import * as d3 from 'd3';
declare let d3: any;

import {VisualisationService} from './visualisation.service';
import {ListenerService} from '../common/services/listener.service';
import {Project} from '../api/models/project';
import {Unit} from '../api/models/unit';

interface BurndownSeries {
  key: string;
  values: [number, number][];
  color?: string;
  classed?: string;
}

@Component({
  selector: 'progress-burndown-chart',
  templateUrl: './progress-burndown-chart.component.html',
  styleUrls: ['./progress-burndown-chart.component.scss'],
})
export class ProgressBurndownChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() project: Project;
  @Input() unit: Unit;
  @ViewChild('chartContainer', {static: true}) chartContainer!: ElementRef;

  private scopeId = 'progress-burndown-chart';
  private listeners: (() => void)[] = [];
  data: any[] = [];
  api: any;

  private _options: any;
  config: any;

  constructor(
    private visualisationService: VisualisationService,
    private listenerService: ListenerService,
  ) {}

  ngOnInit(): void {
    this.project.refreshBurndownChartData?.();

    // Setup listener cleanup
    this.listeners.push(...this.listenerService.listenTo({$id: this.scopeId}));

    // Watch-style update with polling
    const interval = setInterval(() => this.checkDataUpdate(), 1000);
    this.listeners.push(() => clearInterval(interval));
  }

  ngAfterViewInit(): void {
    [this._options, this.config] = this.visualisationService.createVisualisation(
      'lineChart',
      'Student Progress Burndown Chart',
      {
        useInteractiveGuideline: true,
        interactiveLayer: {
          tooltip: {
            contentGenerator: (data: any) => {
              const date = d3.time.format('%b %d')(new Date(data.value));
              const series = data.series;
              let html = `<table class='col-sm-6'><thead><tr><td colspan='3'><strong class='x-value'>${date}</strong></td></tr></thead><tbody>`;
              html += series
                .filter((d: any) => d.key !== 'NOW')
                .map(
                  (d: any) => `
                  <tr>
                    <td class='legend-color-guide'><div style='background-color: ${d.color};'></div></td>
                    <td class='key'>${d.key}</td>
                    <td class='value'>${d3.format(',%')(d.value)}</td>
                  </tr>`
                )
                .join('');
              html += '</tbody></table>';
              return html;
            }
          }
        },
        height: 440,
        margin: {
          left: 75,
          right: 50,
        },
        xAxis: {
          axisLabel: 'Time',
          tickFormat: this.xAxisTickFormatDateFormat,
          ticks: 8,
        },
        yAxis: {
          axisLabel: 'Tasks Remaining',
          tickFormat: this.yAxisTickFormatPercentFormat
        },
        color: this.colorFunction,
        legendColor: this.colorFunction,
        x: this.xAxisClipNegBurndown,
        y: this.yAxisClipNegBurndown,
        yDomain: [0, 1],
        xDomain: this.xDomain,
      },
      {}
    );

    this.api = {refresh: () => {}}; // placeholder for potential visualisation framework
  }

  ngOnDestroy(): void {
    this.listenerService.destroyListeners(this.scopeId);
    this.listeners.forEach((fn) => fn());
  }

  // Adding a helper function to coerce the shape of the values array:
  private coerceBurndownData(data: {key: string; values: number[] }[]): BurndownSeries[] {
    return data.map(entry => {
      const values: [number, number][] = [];
      for (let i = 0; i < entry.values.length; i += 2) {
        values.push([entry.values[i], entry.values[i + 1]]);
      }
      console.log(`[DEBUG] Coerced series "${entry.key}" =>`, values); // adding console log to check the coerced values
      return {
        key: entry.key,
        values,
      };
    });
  }

  private checkDataUpdate(): void {
    if (!this.project?.burndownChartData) {
      console.warn('[DEBUG] No burndownChartData available.');
      return;
    }

    console.log('[DEBUG] Raw burndownChartData:', this.project.burndownChartData);

    const now = new Date().getTime();
    // const newValue: BurndownSeries[] = this.project.burndownChartData;
    const newValue: BurndownSeries[] = this.coerceBurndownData(this.project.burndownChartData);

    const timeSeries: BurndownSeries = {
      key: 'NOW',
      values: [
        [now, 0],
        [now, 1]
      ],
      color: '#CACACA',
      classed: 'dashed'
    };

    if (!newValue.find((d) => d.key === 'NOW')) {
      console.log('[DEBUG] Appending NOW series...'); //  adding console log to check if the series is being appended
      newValue.push(timeSeries);
    }

    this.data.length = 0;
    Object.assign(this.data, newValue);
    console.log('[DEBUG] Final data sent to chart:', this.data); //adding console log to check the data

    if (this.api?.refresh) {
      console.log('[DEBUG] Triggering API refresh...'); //  adding console log to check if API refresh is being called
      this.api.refresh();
    }
  }

  // Helper funtions for formatting

  xAxisTickFormatDateFormat = (d: number): string => {
    return d3.time.format('%b %d')(new Date(d));
  };

  yAxisTickFormatPercentFormat = (d: number): string => {
    return d3.format(',%')(d);
  };

  colorFunction = (_: any, i: number): string => {
    switch (i) {
      case 0:
        return '#AAAAAA'; // projected
      case 1:
        return '#777777'; // target
      case 2:
        return '#0079d8'; // done
      default:
        return '#E01B5D'; // sign off
    }
  };

  xAxisClipNegBurndown = (d: any): number => {
    return d?.[0];
  };

  yAxisClipNegBurndown = (d: any): number => {
    return d ? (d[1] < 0.0 ? 0 : d[1]) : 0;
  };

  get dates() {
    return {
      start: this.unit.startDate,
      end: this.unit.endDate,
    };
  }

  get xDomain() {
    return [this.dates.start, this.dates.end];
  }

  get options() {
    return this._options;
  }
}
