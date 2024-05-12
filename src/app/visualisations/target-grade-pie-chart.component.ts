import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-target-grade-pie-chart',
  templateUrl: './target-grade-pie-chart.component.html'
})
export class TargetGradePieChartComponent implements OnChanges {
  @Input() rawData: any;
  @Input() showLegend: boolean = true;
  @Input() height: number = 400;

  data: any[] = [];
  total: number = 0;
  colorScheme = {
    domain: []
  };

  constructor(private gradeService: GradeService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.rawData) {
      this.updateData();
    }
  }

  updateData(): void {
    this.total = this.rawData.reduce((acc, cur) => acc + cur.value, 0);
    this.data = this.rawData.map(item => ({
      name: this.gradeService.grades[item.grade],
      value: item.value
    }));
    this.colorScheme.domain = this.rawData.map(item => this.gradeService.gradeColors[item.status_key]);
  }
}
