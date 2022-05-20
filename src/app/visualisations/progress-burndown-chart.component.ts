import { Component, Input, Inject, OnInit, OnChanges, SimpleChanges } from '@angular/core';

declare let d3: any;

import * as _ from 'lodash';
import * as moment from 'moment';
import { projectService} from '../ajs-upgraded-providers';
import { VisulizationService} from 'src/app/visualisations/visulization.service';

@Component({
  selector: 'progress-burndown-chart',
  templateUrl: './visualisation.component.html',
  styleUrls: ['./progress-burndown-chart.component.scss'],
})
export class ProgressBurndownChartComponent implements OnInit {
  @Input() project: any;
  @Input() unit: any;

  options: any;
  data: any;
  config: any;
  timeSeries: any;
  newValue: any
  dates: any;
  xDomain: any[];
  title: any;

  constructor(@Inject(VisulizationService) private visualisationService: any) {

  }

  xAxisTickFormatDateFormat(d: number): String {
    return d3.time.format('%b %d')(new Date(d * 1000))
  }
  ngOnChanges(changes: SimpleChanges) {   
  }

  ngOnInit() {   
    this.newValue = this.project.burndown_chart_data;
    let now = +new Date().getTime() / 1000
    this.timeSeries = {
      key: "NOW",
      values: [[now, 0], [now, 1]],
      color: '#CACACA',
      classed: 'dashed'
    };

    if (!_.find(this.newValue, {
      key: 'NOW'
    })) {
      this.newValue.push(this.timeSeries);
    }
    this.data = _.extend({}, this.data, this.newValue)

    this.dates = {
      start: moment(this.unit.start_date),
      // represent the graph as 2 weeks after the unit's end date
      end: moment(this.unit.end_date).add(2, 'weeks')
    }

    this.xDomain = [
      toUnixTimestamp(this.dates.start),
      toUnixTimestamp(this.dates.end)
    ]

    let all_data = []
    Object.entries(this.data).forEach(
      ([key, value]) => {
        const d = value;
        if (d['key'] != 'NOW') {
          const values = d['values']
          let results = []
          values.forEach((arr: any[]) => {
            results.push({ 'x': arr[0], 'y': arr[1] })
          });
          //console.log(results)
          all_data.push({ 'key': d['key'], 'values': results })
        }
      }
    );
    
    this.data = all_data //this.data?[0]?
    //console.log(this.data)   
     
    this.options = {
      chart: {
        type: 'lineChart',
        height: 440,
        margin: {
          left: 75,
          right: 50
        },
      useInteractiveGuideline: true,
      // interactiveLayer: {
      //   tooltip: this.contentGenerator(this.data)   
      // },    
      xAxis: {
        axisLabel: "Time",
        tickFormat: function (d: number) { return xAxisTickFormatDateFormat(d) },
        ticks: 8    
        }, 
        yAxis: {
          axisLabel: "Tasks Remaining",
          tickFormat: function (d: number) { return yAxisTickFormatPercentFormat(d) },
            
        },
        color: function (d: any) { return colorFunction(d, 0)},
        legendColor: function (d: any) { return colorFunction(d, 0)},
        x: function (d: any) { return xAxisClipNegBurndown(d) },
        y: function (d: any) { return yAxisClipNegBurndown(d) },  
        yDomain: [0, 1],
        xDomain: this.xDomain 
      } 
    } 
    const chart_setup = this.visualisationService.show ('lineChart', 'Student Progress Burndown Chart', this.options, [], [], [])    
  }
  } 
    
  // // ngDoCheck() {
  // //     if (this.project.burndown_chart_data == null) {
  // //         return;
  // //     }

  // //     this.config = {}
  // //     this.visualisationProvider('lineChart', 'Student Progress Burndown Chart', this.options, this.config)
  // //   }
 
  function xAxisTickFormatDateFormat(d: number): String {
    return d3.time.format('%b %d')(new Date(d * 1000))
  }

  function yAxisTickFormatPercentFormat(d: number): String {
    return d3.format(',%')(d)
  }

  function colorFunction(d: any, i: number): String { 
    if (d.key == 'Projeted')
      return '#AAAAAA'; // projeted
      if (d.key == 'Target')
      return '#777777'; // target
      if (d.key == 'To Submit')
      return '#0079d8'; // done 
    else //sign off
      return '#E01B5D';
  }

  /*
  No need to clip x axis
  */
  function xAxisClipNegBurndown(d: any): number {
    return d.x;
  }
  /*
  Clips y to 0 if y < 0
  */
  function yAxisClipNegBurndown(d: any): number {
    if (d.y < 0.0) return 0; else return d.y
  }
  /*
  Converts a moment date to a Unix Time Stamp in seconds
  */
  function toUnixTimestamp(momentDate: number): number {
    return +momentDate / 1000
  }
  // Need to generate this so as to not include NOW key
  function contentGenerator(data: any) {
    // let date =(new Date(data.value*1000)).toLocaleDateString()
    // series = data.series
    // let html = "<table class='col-sm-6'><thead><tr><td colspan='3'><strong class='x-value'>#{date}</strong></td></tr></thead><tbody>"
    // html += ("<tr><td class='legend-color-guide'><div style='background-color: #{d.color};'></div></td><td class='key'>#{d.key}</td><td class='value'>#{d3.format(',%')(d.value)}</td></tr><tr>" 
    // for d in series when d.key isnt 'NOW').join('')
    // html += "</tbody></table>"
    return "html" 
     
  }