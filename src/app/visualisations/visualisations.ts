import { NgModule, Injectable, Component, OnInit } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { interval } from 'rxjs';

// Analytics Service
@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  event(category: string, action: string, label: string) {

    console.log(`Event tracked: ${category}, ${action}, ${label}`);
  }
}

// Visualisation Service
@Injectable({
  providedIn: 'root'
})
export class VisualisationService {
  private DEFAULT_OPTS = {
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
      "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
      "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"
    ]
  };

  private DEFAULT_CONF = {
    visible: true,
    extended: false,
    disabled: false,
    autorefresh: true,
    refreshDataOnly: true,
    deepWatchOptions: true,
    deepWatchData: false,
    deepWatchConfig: true,
    debounce: 10
  };

  constructor(private analyticsService: AnalyticsService) {}

  createVisualisation(type: string, visualisationName: string, opts?: any, conf?: any, titleOpts?: any, subtitleOpts?: any) {
    const dirtyOpts = { ...this.DEFAULT_OPTS, ...opts, type };
    const dirtyConf = { ...this.DEFAULT_CONF, ...conf };

    // Google tracking
    this.analyticsService.event('Visualisations', 'Created Visualisation', visualisationName);

    return [{ chart: dirtyOpts, title: titleOpts, subtitle: subtitleOpts }, dirtyConf];
  }

  refreshAll() {
    interval(50).subscribe(() => window.dispatchEvent(new Event('resize')));
  }
}

// Component
@Component({
  selector: 'app-root',
  template: `<h1>Visualisation Example</h1>`,
})
export class AppComponent implements OnInit {
  constructor(private visualisationService: VisualisationService) {}

  ngOnInit() {
    const [visualisationOpts, visualisationConf] = this.visualisationService.createVisualisation('scatter', 'example-visualisation', {}, {}, {}, {});
    console.log('Visualisation Options:', visualisationOpts);
    console.log('Visualisation Configuration:', visualisationConf);
  }
}

// Module
@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
  ],
  providers: [VisualisationService, AnalyticsService],
  bootstrap: [AppComponent]
})
export class AppModule { }
