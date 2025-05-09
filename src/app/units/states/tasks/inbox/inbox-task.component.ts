import { Component, OnInit, Input, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'inbox-task',
  templateUrl: './inbox-task.component.html',
  styleUrls: ['./inbox-task.component.css']
})
export class InboxTaskComponent implements OnInit {
  @Input() unit: any;
  @Input() taskData: any;
  @Input() unitRole: any;
  @Input() task: any;
  @Input() project: any;

  constructor(
    private newTaskService: any,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.taskData.source = this.newTaskService.queryTasksForTaskInbox.bind(this.newTaskService);
    this.taskData.taskDefMode = false;
  }

  ngOnInit(): void {
    // Initialize component
  }
}
