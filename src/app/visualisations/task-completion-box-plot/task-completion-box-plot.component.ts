import {ChangeDetectionStrategy, Component, Input, OnChanges} from '@angular/core';
import {Unit} from 'src/app/api/models/unit';
import {TaskCompletionStats, TaskCompletionSummary} from 'src/app/api/services/unit.service';
import {GradeService} from 'src/app/common/services/grade.service';

@Component({
  selector: 'f-task-completion-box-plot',
  templateUrl: './task-completion-box-plot.component.html',
  styleUrls: ['../unit-analytics-chart.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskCompletionBoxPlotComponent implements OnChanges {
  @Input() unit: Unit;
  @Input() data: TaskCompletionStats;
  @Input() tutorialId: number | null = null;
  group: 'selection' | 'grade' = 'selection';
  rows: {name: string; summary: TaskCompletionSummary}[] = [];
  series: {name: string; series: {name: string; value: number}[]}[] = [];
  hasCompletions = false;

  constructor(private grades: GradeService) {}

  ngOnChanges(): void {
    this.updateData();
  }

  updateData(): void {
    const selection =
      this.tutorialId === null ? this.data?.unit : this.data?.tutorial?.[this.tutorialId];
    const name =
      this.tutorialId === null
        ? 'Unit'
        : (this.unit?.tutorials.find((tutorial) => tutorial.id === this.tutorialId)?.abbreviation ??
          'Tutorial');
    this.rows =
      this.group === 'grade'
        ? Object.entries(this.data?.grade ?? {}).map(([grade, summary]) => ({
            name: this.grades.gradeLabel(Number(grade), this.unit) ?? `Grade ${grade}`,
            summary,
          }))
        : selection
          ? [{name, summary: selection}]
          : [];
    this.rows = this.rows.filter(({summary}) =>
      ['min', 'lower', 'median', 'upper', 'max'].every(
        (key) => Number.isFinite(summary?.[key]) && summary[key] >= 0,
      ),
    );
    // ngx-charts computes quartiles from its input. Five ordered summary values place
    // Q1, median and Q3 exactly at the supplied lower, median and upper values.
    // Do not treat these as student samples or recompute the API's summary.
    this.series = this.rows.map(({name: label, summary}) => ({
      name: label,
      series: ['min', 'lower', 'median', 'upper', 'max'].map((key) => ({
        name: key,
        value: summary[key],
      })),
    }));
    this.hasCompletions = this.rows.some(({summary}) => summary.max > 0);
  }
}
