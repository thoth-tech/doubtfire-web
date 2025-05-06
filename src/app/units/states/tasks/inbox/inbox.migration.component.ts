// src/app/units/states/tasks/inbox/task-inbox.component.ts
import { Component, OnInit }       from '@angular/core';
import { ActivatedRoute }          from '@angular/router';
import { TaskService }             from 'src/app/api/services/task.service';

interface TaskData {
  source: () => any;
  taskDefMode: boolean;
}

@Component({
  selector: 'app-task-inbox',
  templateUrl: './inbox.component.html',
  styleUrls:   ['./inbox.component.css']
})
export class TaskInboxComponent implements OnInit {
  taskKey!: string;
  taskData: TaskData = {
    source: () => {},
    taskDefMode: false
  };

  constructor(
    private route: ActivatedRoute,
    private taskService: TaskService
  ) {}

  ngOnInit(): void {
    // grab the dynamic {taskKey}
    this.taskKey = this.route.snapshot.paramMap.get('taskKey')!;

    // port over the old service binding
    this.taskData.source = this.taskService
      .queryTasksForTaskInbox
      .bind(this.taskService);

    this.taskData.taskDefMode = false;
  }
}
