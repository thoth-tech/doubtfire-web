// achievement-custom-bar-chart.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { VisualisationService } from 'visualisations';
import { OutcomeService } from '../common/services/outcome-service';
import { GradeService } from '../common/services/grade.service';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-achievement-custom-bar-chart',
  templateUrl: './achievement-custom-bar-chart.component.html',
})
export class AchievementCustomBarChart implements OnInit {
  @Input() project;
  @Input() unit;
  showLegend = true;


  constructor(
    private visualisationService: VisualisationService,
    private outcomeService: OutcomeService,
    private gradeService: GradeService,
    private sanitizer: DomSanitizer,
  ) {}
ngOnInit() {
    this.showLegend = this.showLegend ? this.showLegend : true;
    var nv;
    if (!nv.models.achievementBar) {
      nv.models.achievementBar = () => {
        let chart = (selection) => {
          selection.each((data) => {
            let availableWidth = data.width - data.margin.left - data.margin.right;
            let availableHeight = data.height - data.margin.top - data.margin.bottom;
            let container = d3.select(this);
            nv.utils.initSVG(container);
            data.forEach((series, i) => {
              series.values.forEach((point) => {
                point.series = i;
              });
            });
            let seriesData = xDomain && yDomain ? [] : data.map((d) => {
              return d.values.map((d, i) => {
                return { x: getX(d, i), y: getY(d, i) };
              });
            });
          });
        };
        return chart;
      };
    }
  }
}
