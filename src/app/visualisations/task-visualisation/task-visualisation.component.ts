import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import {Project, TaskStatus, TaskStatusEnum} from 'src/app/api/models/doubtfire-model';

interface TaskStatusSummary {
  status: TaskStatusEnum;
  name: string;
  value: number;
  color: string;
  textColor: string;
}

@Component({
  selector: 'f-task-visualisation',
  templateUrl: './task-visualisation.component.html',
  styleUrls: ['./task-visualisation.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskVisualisationComponent implements OnChanges, OnInit {
  @Input() project: Project;
  @Input() grade: number;

  data: TaskStatusSummary[] = [];

  ngOnInit(): void {
    this.updateData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const projectChanged = 'project' in changes && !changes.project.firstChange;
    const gradeChanged = 'grade' in changes && changes.grade.currentValue !== undefined;

    if (projectChanged || gradeChanged) {
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

      const sortOrder: TaskStatusEnum[] = [
        'complete',
        'discuss',
        'ready_for_feedback',
        'working_on_it',
        'not_started',
      ];

      this.data = Array.from(taskCounts)
        .map(([status, count]) => {
          const color = TaskStatus.STATUS_COLORS.get(status) ?? '#64748b';
          return {
            status,
            name: TaskStatus.STATUS_LABELS.get(status) ?? status,
            value: count,
            color,
            textColor: this.contrastingTextColor(color),
          };
        })
        .filter((task) => task.value > 0 || sortOrder.includes(task.status))
        .sort((a, b) => {
          let aIndex = sortOrder.indexOf(a.status);
          let bIndex = sortOrder.indexOf(b.status);

          aIndex = aIndex === -1 ? sortOrder.length : aIndex;
          bIndex = bIndex === -1 ? sortOrder.length : bIndex;

          return aIndex - bIndex;
        });
    }
  }

  private contrastingTextColor(color: string): string {
    const hex = color.replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(hex)) {
      return '#ffffff';
    }

    const channels = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
    const [red, green, blue] = channels.map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    // #111827 was too light to be the dark option here. Against ready_for_feedback
    // (#0079D8) it reached 3.99:1 and white only 4.44:1, so the card that always renders
    // sat under the 4.5:1 AA floor for normal text. Black clears the floor on every
    // status colour, and the divisor now matches the colour it is measuring.
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const whiteContrast = 1.05 / (luminance + 0.05);
    const darkContrast = (luminance + 0.05) / 0.05;

    return whiteContrast >= darkContrast ? '#ffffff' : '#000000';
  }
}
