import { Component, Input, OnInit } from '@angular/core';
import { TaskDefinition } from 'src/app/api/models/task-definition';

@Component({
  selector: 'f-task-sheet-view',
  templateUrl: './f-task-sheet-view.component.html',
  styleUrls: ['./f-task-sheet-view.component.scss'],
})
export class FTaskSheetViewComponent {
  @Input() taskDef: TaskDefinition;

}
