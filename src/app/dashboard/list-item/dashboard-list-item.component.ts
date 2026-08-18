import {Component, Input} from '@angular/core';
import {TaskDefinition} from '../../api/models/task-definition';
import {TaskStatusEnum} from '../../api/models/task-status';

export type DashboardTask = {
  title: string;
  subtitle: string;
  statusLabel: string;
  abbreviation: string;
  color: string;
  comments: number;
  status: TaskStatusEnum;
  weight: number;
  projectId: number;
  description: string;
  taskDef: TaskDefinition;
  unitCode: string;
  dueDate: Date;
};

@Component({
  selector: 'f-dashboard-list-item',
  standalone: false,
  templateUrl: './dashboard-list-item.component.html',
})
export class DashboardListItemComponent {
  @Input() task: DashboardTask;

  isExpanded = false;
}
