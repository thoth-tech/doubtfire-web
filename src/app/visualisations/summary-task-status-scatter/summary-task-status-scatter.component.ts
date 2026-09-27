import {ChangeDetectionStrategy, Component, Input, OnChanges} from '@angular/core';
import {TaskStatus, Unit} from 'src/app/api/models/doubtfire-model';
import {TaskStatusStats} from 'src/app/api/services/unit.service';

@Component({
  selector: 'f-summary-task-status-scatter',
  templateUrl: './summary-task-status-scatter.component.html',
  styleUrls: ['../unit-analytics-chart.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class SummaryTaskStatusScatterComponent implements OnChanges {
  @Input() unit: Unit;
  @Input() data: TaskStatusStats = {};
  @Input() tutorialId: number | null = null;
  taskId: number | null = null;
  rows: {task: string; status: string; count: number}[] = [];
  series: {name: string; series: {name: string; x: number; y: number; r: number}[]}[] = [];
  readonly Math = Math;
  readonly statuses = TaskStatus.STATUS_KEYS;
  readonly xTicks = this.statuses.map((_, index) => index);
  yTicks: number[] = [];
  formatStatus = (value: number): string =>
    TaskStatus.STATUS_LABELS.get(this.statuses[value]) ?? '';
  formatTask = (value: number): string => this.series[value]?.name ?? '';

  ngOnChanges(): void {
    if (!this.unit?.taskDefinitions.some((task) => task.id === this.taskId)) {
      this.taskId = null;
    }
    this.updateData();
  }

  updateData(): void {
    this.rows = [];
    this.series = (this.unit?.taskDefinitions ?? [])
      .filter((task) => this.taskId === null || task.id === this.taskId)
      .map((task, y) => {
        const totals: Map<string, number> = new Map();
        Object.entries(this.data?.[task.id] ?? {}).forEach(([tutorial, stats]) => {
          if (this.tutorialId !== null && tutorial !== String(this.tutorialId)) {
            return;
          }
          stats.forEach(({status, num}) => {
            if (Number.isFinite(num) && num > 0 && this.statuses.some((key) => key === status)) {
              totals.set(status, (totals.get(status) ?? 0) + num);
            }
          });
        });
        return {
          name: task.abbreviation,
          series: this.statuses.flatMap((status, x) => {
            const count = totals.get(status) ?? 0;
            if (!count) {
              return [];
            }
            const label = TaskStatus.STATUS_LABELS.get(status);
            this.rows.push({task: task.abbreviation, status: label, count});
            return [{name: label, x, y, r: count}];
          }),
        };
      });
    this.yTicks = this.series.map((_, index) => index);
  }
}
