import {Component, Input} from '@angular/core';
import {TaskDefinition} from '../../api/models/task-definition';
import {TaskStatusEnum} from '../../api/models/task-status';

export type DueDateWarning = {
  state: 'overdue' | 'within24Hours' | 'within3Days' | 'within7Days';
  label: string;
  icon: string;
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function getDueDateWarning(
  dueDate: Date | null | undefined,
  showWarning: boolean,
  now: Date = new Date(),
): DueDateWarning | null {
  if (!showWarning || !(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) {
    return null;
  }

  const millisecondsUntilDue = dueDate.getTime() - now.getTime();

  if (millisecondsUntilDue < 0) {
    return {state: 'overdue', label: 'Overdue', icon: 'error'};
  }

  if (millisecondsUntilDue <= DAY_IN_MILLISECONDS) {
    return {state: 'within24Hours', label: 'Due within 24 hours', icon: 'schedule'};
  }

  if (millisecondsUntilDue <= 3 * DAY_IN_MILLISECONDS) {
    return {state: 'within3Days', label: 'Due within 3 days', icon: 'warning'};
  }

  if (millisecondsUntilDue <= 7 * DAY_IN_MILLISECONDS) {
    return {state: 'within7Days', label: 'Due within 7 days', icon: 'event'};
  }

  return null;
}

export type DashboardTask = {
  taskDefinitionId: number;
  title: string;
  subtitle: string;
  statusLabel: string;
  abbreviation: string;
  color: string;
  comments: number;
  status: TaskStatusEnum;
  targetGrade: number;
  targetGradeLabel: string;
  weight: number;
  projectId: number;
  description: string;
  taskDef: TaskDefinition;
  unitCode: string;
  dueDate: Date | null | undefined;
  showDueWarning: boolean;
};

@Component({
  selector: 'f-dashboard-list-item',
  standalone: false,
  templateUrl: './dashboard-list-item.component.html',
})
export class DashboardListItemComponent {
  @Input() task: DashboardTask;

  isExpanded = false;

  get dueDateWarning(): DueDateWarning | null {
    return getDueDateWarning(this.task?.dueDate, this.task?.showDueWarning ?? false);
  }
}
