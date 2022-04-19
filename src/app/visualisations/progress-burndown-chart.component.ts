import { Component, Input, Inject} from '@angular/core';
 //import { listenerService } from 'src/app/ajs-upgraded-providers';

@Component({
    selector: 'progress-burndown-chart',
    templateUrl: 'visualisations/visualisation.html',
    styleUrls: ['progress-burndown-chart.component.scss'],
})
export class ProgressBurndownChartComponent {
    @Input() project: any;
    @Input() unit: any;  
   
    constructor(@Inject(Visualisation) private visualisationFactory: any) { } 

    xAxisTickFormatDateFormat(d) {
        return d3.time.format('%b %d')(new Date(d * 1000))
       }      
   
    yAxisTickFormatPercentFormat(d){
        return d3.format(',%')(d)
    }

    colorFunction (d, i){
        if (i == 0)
            return '#AAAAAA'; // projeted
        else if (i == 1)
            return '#777777'; // target
        else if (i == 2)
            return '#0079d8'; // done 
        else //sign off
            return '#E01B5D';
        }

    /*
    No need to clip x axis
    */   
    xAxisClipNegBurndown (d){
        return d[0];
    }
   
    /*
    Clips y to 0 if y < 0
    */
    yAxisClipNegBurndown (d){
        if (d[1] < 0.0) return 0; else return d[1]
    } 
    /*
    Converts a moment date to a Unix Time Stamp in seconds
    */
    toUnixTimestamp (momentDate){
        return +momentDate / 1000
    }

    ngDoCheck() {

        if (this.project.burndown_chart_data == null) {
            return;
        }
        let newValue = this.project.burndown_chart_data;
        let data: any = [];                        
        var now: any; 
        var Key: any;
        now = +new Date().getTime() / 1000
        let timeSeries = {
            key: "NOW",
            values: [[now, 0],[now, 1]],
            color: '#CACACA',
            classed: 'dashed'
        };      

        if (!_.find(newValue, {
            key: 'NOW'
            })) {
            newValue.push(timeSeries);
            }
            data.length = 0;
            _.extend(data, newValue);
        
        //   if ((newValue.hasOwnProperty('NOW')))
        //       Key = 'NOW';
        //   else
        //       newValue.push(timeSeries); 

        /*
        Graph unit dates as moment.js dates
        */
        let dates = {
            start: moment(this.unit.start_date);
            // represent the graph as 2 weeks after the unit's end date
            end:   moment(this.unit.end_date).add(2, 'weeks')
            }
         /*
        X domain is defined as the unit's start date to the unit's end date add two weeks
         */
        let xDomain = [
            this.toUnixTimestamp(dates.start),
            this.toUnixTimestamp(dates.end)
        ]        
  
        //Visualisation = (type, visualisationName, opts, conf, titleOpts, subtitleOpts) ->
        // <nvd3 options="options" data="data" id="chart" api="api" config="config"></nvd3>
        return ref = this.visualisationFactory('lineChart', 'Student Progress Burndown Chart', {
            useInteractiveGuideline: true,
            interactiveLayer: {
              tooltip: {
                contentGenerator: function(data) {
                  var d, date, html, series;
                  date = data.value;
                  series = data.series;
                  html = "<table class='col-sm-6'><thead><tr><td colspan='3'><strong class='x-value'>" + date + "</strong></td></tr></thead><tbody>";
                  html += ((function() {
                    var j, len, results;
                    results = [];
                    for (j = 0, len = series.length; j < len; j++) {
                      d = series[j];
                      if (d.key !== 'NOW') {
                        results.push("<tr><td class='legend-color-guide'><div style='background-color: " + d.color + ";'></div></td><td class='key'>" + d.key + "</td><td class='value'>" + (d3.format(',%')(d.value)) + "</td></tr><tr>");
                      }
                    }
                    return results;
                  })()).join('');
                  html += "</tbody></table>";
                  return html;
                }
              }
            },
            height: 440,
            margin: {
              left: 75,
              right: 50
            },
            xAxis: {
              axisLabel: "Time",
              tickFormat: this.xAxisTickFormatDateFormat,
              ticks: 8
            },
            yAxis: {
              axisLabel: "Tasks Remaining",
              tickFormat: this.yAxisTickFormatPercentFormat
            },
            color: this.colorFunction,
            legendColor: this.colorFunction,
            x: this.xAxisClipNegBurndown,
            y: this.yAxisClipNegBurndown,
            yDomain: [0, 1],
            xDomain: xDomain
          }, {}), $scope.options = ref[0], $scope.config = ref[1], ref;
        }]
      };
    });
    

function Visualisation(Visualisation: any) {
    throw new Error('Function not implemented.');
}
     