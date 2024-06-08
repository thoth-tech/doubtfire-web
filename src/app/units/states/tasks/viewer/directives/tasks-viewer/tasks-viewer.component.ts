import {Component, Input} from '@angular/core';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {Unit} from 'src/app/api/models/unit';
import {BehaviorSubject} from 'rxjs';

@Component({
  selector: 'f-tasks-viewer',
  templateUrl: './tasks-viewer.component.html',
  styleUrls: ['./tasks-viewer.component.scss'],
})
export class TasksViewerComponent {
  @Input() taskDefs: TaskDefinition[];
  @Input() unit: Unit;

  /**
   * Monitor and publish the selected task definition for child components.
   * We monitor the task definition list for changes in selected task definition.
   */
  selectedTaskDefinition$: BehaviorSubject<TaskDefinition> = new BehaviorSubject<TaskDefinition>(
    null,
  );

  public get taskSelected(): boolean {
    return this.selectedTaskDef !== null;
  }

  public get selectedTaskDef(): TaskDefinition {
    return this.selectedTaskDefinition$.value;
  }

  public clearTaskSelection(): void {
    this.selectedTaskDefinition$.next(null);
  }
}
