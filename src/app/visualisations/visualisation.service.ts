import {Inject, Injectable} from '@angular/core';
import {analyticsService} from '../ajs-upgraded-providers';

@Injectable({
  providedIn: 'root',
})
export class VisualisationService {
  private readonly DEFAULT_OPTS = {
    objectequality: true,
    interactive: true,
    showValues: true,
    showXAxis: true,
    showYAxis: true,
    showLegend: true,
    transitionDuration: 500,
    duration: 500,
    height: 600,
    color: [
      '#1f77b4',
      '#ff7f0e',
      '#2ca02c',
      '#d62728',
      '#9467bd',
      '#8c564b',
      '#e377c2',
      '#7f7f7f',
      '#bcbd22',
      '#17becf',
    ],
  };

  private readonly DEFAULT_CONF = {
    visible: true,
    extended: false,
    disabled: false,
    autorefresh: true,
    refreshDataOnly: true,
    deepWatchOptions: true,
    deepWatchData: false,
    deepWatchConfig: true,
    debounce: 10,
  };

  constructor(@Inject(analyticsService) private analyticsService) {}

  /**
   * Creates a visualisation configuration.
   * @param type The type of the chart (e.g., 'pieChart').
   * @param visualisationName The name of the visualisation.
   * @param opts Additional options for the chart.
   * @param conf Additional configuration for the chart.
   * @param titleOpts Title options for the chart.
   * @param subtitleOpts Subtitle options for the chart.
   * @returns An array containing the chart options and configuration.
   */
  createVisualisation(
    type: string,
    visualisationName: string,
    opts = {},
    conf = {},
    titleOpts?,
    subtitleOpts?,
  ): [
    {chart: typeof this.DEFAULT_OPTS & {type: string}; title; subtitle},
    typeof this.DEFAULT_CONF,
  ] {
    const dirtyOpts = {...this.DEFAULT_OPTS, ...opts, type};
    const dirtyConf = {...this.DEFAULT_CONF, ...conf};

    this.analyticsService.event('Visualisations', 'Created Visualisation', visualisationName);

    return [{chart: dirtyOpts, title: titleOpts, subtitle: subtitleOpts}, dirtyConf];
  }

  /**
   * Refreshes all visualisations by triggering a window resize event.
   */
  refreshAll(): void {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }
}
