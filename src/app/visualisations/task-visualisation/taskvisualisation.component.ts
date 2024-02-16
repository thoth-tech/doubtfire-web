import { Component, OnInit, Input, SimpleChanges } from '@angular/core';
import { TaskStatus } from 'src/app/api/models/task-status';
import * as moment from 'moment';

@Component({
  selector: 'app-task-visualisation',
  templateUrl: './taskvisualisation.component.html',
  styleUrls: ['./taskvisualisation.component.scss']
})

export class TaskVisualisationComponent implements OnInit {
  @Input() project: any;
  @Input() grade: any;

  data: any[] = [];
  colors: any[] = [];

  // options
  textColor: string = '#F5F5F5';

  constructor() {
    this.data = [];
    this.colors = [];
  }

  ngOnInit(): void {
    this.updateData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('grade' in changes && changes.grade.currentValue !== undefined) {
      this.updateData();
    }
  }

  updateData(): void {
    if (this.project) {
      const taskCounts = new Map(TaskStatus.STATUS_KEYS.map((status) => [status, 0]));
      const activeTasks = this.project.activeTasks();
      activeTasks.forEach((task) => {
        if (task.status) {
          taskCounts.set(task.status, (taskCounts.get(task.status) || 0) + 1);
        }
      });

      const sortOrder = ['Complete', 'Not Started', 'Working On It'];

      this.data = Array.from(taskCounts)
        .map(([status, count]) => {
          return {
            name: this.formatTaskStatus(status),
            value: count,
          };
        })
        .sort((a, b) => {
          let aIndex = sortOrder.indexOf(a.name);
          let bIndex = sortOrder.indexOf(b.name);

          aIndex = aIndex === -1 ? sortOrder.length : aIndex;
          bIndex = bIndex === -1 ? sortOrder.length : bIndex;

          return aIndex - bIndex;
        });

      this.colors = Array.from(TaskStatus.STATUS_COLORS).map(([status, color]) => {
        return { status: status, color: color };
      });

      console.log('Data:', this.data);
      console.log('Colors:', this.colors);
    }
  }

  getTaskChartColors(): any[] {
    const customColors = this.colors.map((colorMapping) => {
      const task = this.data.find(
        (task) => this.formatTaskStatus(task.name) === this.formatTaskStatus(colorMapping.status)
      );

      const color = task && task.value > 0 ? colorMapping.color : '#EEEEEE';

      return {
        name: this.formatTaskStatus(colorMapping.status),
        value: color,
      };
    });
    return customColors;
  }

  // to perform parsing of task labels..
  formatTaskStatus(status: string): string {
    const words = status.replace(/[^a-zA-Z ]/g, ' ').split(' ');
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }

  onSelect(event) {
    console.log(event);
  }
}
