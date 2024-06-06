import {Component, Input, OnInit, output} from '@angular/core';
import {Grade} from 'src/app/api/models/grade';
import {TaskDefinition, Task} from 'src/app/api/models/doubtfire-model';
import {TaskDefinitionNamePipe} from 'src/app/common/filters/task-definition-name.pipe';
import {TasksViewerService} from '../../../tasks-viewer.service';

@Component({
  selector: 'f-unit-task-list',
  templateUrl: './f-unit-task-list.component.html',
  styleUrls: ['./f-unit-task-list.component.scss'],
})
export class FUnitTaskListComponent implements OnInit {
  @Input() mode: 'project' | 'all-tasks';
  @Input() taskDefinitions: TaskDefinition[];
  @Input() tasks: Task[];

  selectedTaskDefinition = output<TaskDefinition>();

  // @Output() selectedTask: EventEmitter<Task> = new EventEmitter<Task>();

  filteredTasks: TaskDefinition[]; // list of tasks which match the taskSearch term
  taskSearch: string = ''; // task search term from user input
  taskDefinitionNamePipe = new TaskDefinitionNamePipe();
  protected gradeNames: string[] = Grade.GRADES;
  selectedTaskDef: TaskDefinition;
  taskSelected: boolean;

  constructor(private taskViewerService: TasksViewerService) {}

  applyFilters() {
    this.filteredTasks = this.taskDefinitionNamePipe.transform(
      this.taskDefinitions,
      this.taskSearch,
    );
  }

  public get hasTasks(): boolean {
    return this.tasks && this.tasks.length > 0;
  }

  public taskForTaskDef(taskDef: TaskDefinition): Task {
    return this.tasks.find((task) => task.definition.id === taskDef.id);
  }

  ngOnInit(): void {
    this.applyFilters();

    // TODO: Remove the service
    this.taskViewerService.selectedTaskDef.subscribe((taskDef) => {
      this.selectedTaskDef = taskDef;
    });

    this.taskViewerService.taskSelected.subscribe((taskSelected) => {
      this.taskSelected = taskSelected;
    });

    // Select the first task definition by default
    if (this.taskDefinitions.length > 0) {
      this.setSelectedTaskDefinition(this.taskDefinitions[0]);
    }
  }

  setSelectedTaskDefinition(taskDef: TaskDefinition) {
    this.selectedTaskDefinition.emit(taskDef);
    // const selectedTask = this.taskForTaskDef(taskDef);
    // if (selectedTask) {
    //   this.selectedTask$.next(selectedTask);
    // }

    //TODO: remove
    this.taskViewerService.setSelectedTaskDef(taskDef);
  }

  isSelectedTaskDefinition(task: TaskDefinition) {
    return this.selectedTaskDef.id == task.id;
  }
}
