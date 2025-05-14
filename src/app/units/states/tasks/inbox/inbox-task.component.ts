import {Component, Input, OnInit} from '@angular/core';
import {Observable} from 'rxjs';
import {TaskService} from 'src/app/api/services/task.service';
import {Unit} from 'src/app/api/models/unit';
import {UnitRole} from 'src/app/api/models/unit-role';
import {Task} from 'src/app/api/models/task';
import {Project} from 'src/app/api/models/project';

@Component({
  selector: 'f-inbox',
  templateUrl: './inbox-task.component.html',
  styleUrls: ['./inbox-task.component.css'],
})
export class InboxTaskComponent implements OnInit {
  @Input() unit!: Unit;
  @Input() unitRole!: UnitRole;
  @Input() project!: Project;
  @Input() task!: Task;

  /**
    This mirrors the old `$scope.taskData` shape.
    `source` returns an Observable of the Task[] inbox.
   */
  @Input() taskData!: {
    taskKey?: number;
    source?: () => Observable<Task[]>;
    taskDefMode?: boolean;
    selectedTask?: Task;
    onSelectedTaskChange?: (task: Task) => void;
  };

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    // wire up the loader and default mode exactly as before
    this.taskData.source = this.taskService.queryTasksForTaskInbox.bind(this.taskService);
    this.taskData.taskDefMode = false;
  }
}