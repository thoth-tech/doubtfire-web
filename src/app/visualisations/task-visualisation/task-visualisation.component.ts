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

// The four statuses every student moves through always show, so the card keeps its
// shape. The rest show only while a task is in them: fifteen tiles, most of them 0,
// made the card a wall of colour.
const ALWAYS_SHOWN: TaskStatusEnum[] = [
  'not_started',
  'working_on_it',
  'ready_for_feedback',
  'complete',
];

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

      this.data = TaskStatus.PEER_PROGRESS_DISPLAY_ORDER.map((status) => {
        const count = taskCounts.get(status) ?? 0;
        const key = status.replace(/_/g, '-');
        return {
          status,
          name: TaskStatus.STATUS_LABELS.get(status) ?? status,
          value: count,
          color: `var(--ot-status-${key})`,
          textColor: `var(--ot-status-${key}-on)`,
        };
      }).filter(
        ({status, value}) =>
          TaskStatus.isStatus(status) && (value > 0 || ALWAYS_SHOWN.includes(status)),
      );
    }
  }
}
