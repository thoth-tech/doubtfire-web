import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import {FormControl} from '@angular/forms';
import {MatAutocompleteSelectedEvent} from '@angular/material/autocomplete';
import {MatTableDataSource} from '@angular/material/table';
import {Observable, Subscription} from 'rxjs';
import {Task} from 'src/app/api/models/task';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {TaskPrerequisite} from 'src/app/api/models/task-prerequisite';
import {TaskStatusEnum} from 'src/app/api/models/task-status';
import {Unit} from 'src/app/api/models/unit';
import {TaskDefinitionService} from 'src/app/api/services/task-definition.service';
import {TaskPrerequisiteService} from 'src/app/api/services/task-prerequisite.service';
import {AlertService} from 'src/app/common/services/alert.service';

@Component({
  selector: 'f-task-definition-prerequisites',
  templateUrl: 'task-definition-prerequisites.component.html',
  styleUrls: ['task-definition-prerequisites.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskDefinitionPrerequisitesComponent implements OnInit, OnChanges, OnDestroy {
  @Input() taskDefinition: TaskDefinition;
  @Input() staffView: boolean;
  @Input() task: Task;

  displayedColumns: string[] = ['task-definition', 'minimum-required-state', 'actions'];

  private prereqSub?: Subscription;
  private searchSub?: Subscription;

  public dataSource: MatTableDataSource<TaskPrerequisite> = new MatTableDataSource();

  selectedTaskPrerequisite: TaskDefinition | null = null;
  // The search box drives the autocomplete through this control alone. It also
  // had [(ngModel)] on it, which Angular warns about, and the two fought over
  // the value.
  searchCtrl: FormControl<string | TaskDefinition> = new FormControl('');

  // All other task definitions in the unit (exclude the current one)
  filteredTaskDefs: TaskDefinition[] = [];

  public readonly STATES: Partial<Record<TaskStatusEnum, number>> = {
    ready_for_feedback: 1,
    assess_in_portfolio: 1,
    discuss: 2,
    attention_required: 0,
    demonstrate: 2,
    complete: 3,
  };

  public readonly stateOptions = [
    {value: 'ready_for_feedback', label: 'Ready for feedback'},
    {value: 'discuss', label: 'Discuss'},
    {value: 'complete', label: 'Complete'},
  ];

  constructor(
    private taskDefinitionService: TaskDefinitionService,
    private alertService: AlertService,
    private taskPrerequisiteService: TaskPrerequisiteService,
  ) {}
  public get unit(): Unit {
    return this.taskDefinition?.unit;
  }

  public get prerequisites(): Observable<TaskPrerequisite[]> {
    return this.taskDefinition.taskPrerequisitesCache.values;
  }

  ngOnInit(): void {
    this.searchSub = this.searchCtrl.valueChanges.subscribe((value) => {
      // Typing again after picking a task means the pick no longer stands.
      if (typeof value === 'string') {
        this.selectedTaskPrerequisite = null;
      }
      const search = (typeof value === 'string' ? value : value?.name || '').toLowerCase();
      this.filterTaskDefs(search);
    });

    // ngOnChanges has already subscribed when the task came in as an input.
    if (!this.prereqSub && this.taskDefinition) {
      this.watchPrerequisites();
    }
  }

  ngOnDestroy(): void {
    this.prereqSub?.unsubscribe();
    this.searchSub?.unsubscribe();
  }

  private watchPrerequisites() {
    this.prereqSub?.unsubscribe();
    this.prereqSub = this.taskDefinition.taskPrerequisitesCache.values.subscribe((values) => {
      this.dataSource.data = values;
    });
  }

  private mapPrerequisites(taskDefinition: TaskDefinition) {
    const prerequisites = taskDefinition.taskPrerequisitesCache.currentValues;
    const definitions = taskDefinition.unit.taskDefinitions;
    for (const prerequisite of prerequisites) {
      prerequisite.taskDefinition = definitions.find(
        (td) => td.id === prerequisite.taskDefinitionId,
      );
      prerequisite.prerequisite = definitions.find((td) => td.id === prerequisite.prerequisiteId);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes.taskDefinition &&
      changes.taskDefinition.previousValue?.id !== changes.taskDefinition.currentValue?.id
    ) {
      this.selectedTaskPrerequisite = null;
      this.searchCtrl.setValue('', {emitEvent: false});
      this.filterTaskDefs('');
      this.watchPrerequisites();
      this.fetchTaskPrerequisites();
    }
  }

  private fetchTaskPrerequisites() {
    const taskDefinition = this.taskDefinition;
    if (!taskDefinition.id) {
      return;
    }
    this.taskPrerequisiteService
      .query(
        {
          unitId: this.unit.id,
          taskDefId: taskDefinition.id,
        },
        {
          cache: taskDefinition.taskPrerequisitesCache,
        },
      )
      .subscribe({
        next: (data) => {
          for (const prereq of data) {
            if (prereq.taskDefinitionId !== taskDefinition.id) {
              continue;
            }
            taskDefinition.taskPrerequisitesCache.getOrCreate(
              prereq.id,
              this.taskPrerequisiteService,
              prereq,
            );
          }
          this.mapPrerequisites(taskDefinition);
          this.filterTaskDefs(this.searchText());
        },
        error: (error) => {
          this.alertService.error(
            `Failed to fetch prerequisites for task definition: ${error}`,
            6000,
          );
        },
      });
  }

  private searchText(): string {
    const value = this.searchCtrl.value;
    return (typeof value === 'string' ? value : '').toLowerCase();
  }

  private filterTaskDefs(search: string) {
    const taskDefinition = this.taskDefinition;
    if (!taskDefinition?.unit) {
      this.filteredTaskDefs = [];
      return;
    }

    this.filteredTaskDefs = taskDefinition.unit.taskDefinitionCache.currentValues
      // Hide self from the list
      .filter((td) => td.id !== taskDefinition.id)
      // Hide tasks already added as a prerequisite. By id: the linked task is
      // only filled in once the list has loaded, and reading it before then
      // threw and stopped the list from filtering at all.
      .filter(
        (td) =>
          !taskDefinition.taskPrerequisitesCache.currentValues.some(
            (p: TaskPrerequisite) => (p.prerequisite?.id ?? p.prerequisiteId) === td.id,
          ),
      )
      // Higher target grades can not be a prerequisite
      .filter((td) => td.targetGrade <= taskDefinition.targetGrade)
      // Tasks with a later due date can not be a prerequisite
      // .filter((td) => td.targetDate <= this.taskDefinition.targetDate)
      // Search filter
      .filter(
        (td) =>
          (td.name ?? '').toLowerCase().includes(search) ||
          (td.abbreviation ?? '').toLowerCase().includes(search),
      );
  }

  displayFn(td: TaskDefinition | string | null): string {
    if (typeof td === 'string') {
      return td;
    }
    return td?.abbreviation ? `${td.abbreviation} - ${td.name}` : '';
  }

  public onPrerequisitePicked(event: MatAutocompleteSelectedEvent): void {
    this.selectedTaskPrerequisite = event.option.value;
  }

  public addTaskPrerequisite(event: Event): void {
    event.stopPropagation();
    const taskDefinition = this.taskDefinition;
    const selectedTaskPrerequisite = this.selectedTaskPrerequisite;

    this.selectedTaskPrerequisite = null;

    if (!taskDefinition) {
      return this.alertService.error('Invalid task definition', 6000);
    }

    if (!selectedTaskPrerequisite) {
      return this.alertService.error(
        'Please select a task definition to add as a prerequisite',
        6000,
      );
    }

    this.taskDefinitionService
      .addTaskPrerequisite(taskDefinition, selectedTaskPrerequisite)
      .subscribe({
        next: (response) => {
          if (!response) {
            this.alertService.error('Failed to add task prerequisite', 6000);
            return;
          }
          taskDefinition.taskPrerequisitesCache.getOrCreate(
            response.id,
            this.taskPrerequisiteService,
            response,
          );
          this.mapPrerequisites(taskDefinition);

          this.alertService.success(
            `Successfully added task ${selectedTaskPrerequisite.abbreviation} as a prerequisite`,
            5000,
          );
          // The unit used to be reloaded here. It carries nothing about
          // prerequisites, and the reload wrote the server's copy over the open
          // task, so any edits not yet saved were lost without a word.
          this.searchCtrl.setValue('');
        },
        error: (error) => {
          this.alertService.error(`Failed to add task prerequisite: ${error}`, 6000);
        },
      });
  }

  public updateTaskPrerequisite(prerequisiteLink: TaskPrerequisite) {
    prerequisiteLink.taskDefinition ??= this.taskDefinition;
    this.taskDefinitionService
      .updateTaskPrerequisite(prerequisiteLink, prerequisiteLink.taskStatus)
      .subscribe({
        next: (response) => {
          if (!response) {
            this.alertService.error('Failed to update task prerequisite', 6000);
            return;
          }
          this.alertService.success(
            `Updated prerequisite ${prerequisiteLink.prerequisite?.abbreviation ?? ''}`.trim(),
            5000,
          );
        },
        error: (error) => {
          this.alertService.error(`Failed to update task prerequisite: ${error}`, 6000);
        },
      });
  }

  public removePrerequisite(prerequisiteToRemove: TaskPrerequisite) {
    if (!prerequisiteToRemove) {
      return;
    }

    // Removed here rather than with TaskPrerequisite.delete, which reads the unit
    // through a link that is not always filled in yet, and which reports a
    // successful delete as an error.
    const taskDefinition = this.taskDefinition;
    this.taskPrerequisiteService
      .delete<void>(
        {
          unitId: taskDefinition.unit.id,
          taskDefId: prerequisiteToRemove.taskDefinitionId ?? taskDefinition.id,
          prerequisiteId: prerequisiteToRemove.prerequisiteId,
        },
        {cache: taskDefinition.taskPrerequisitesCache},
      )
      .subscribe({
        next: () => {
          taskDefinition.taskPrerequisitesCache.delete(prerequisiteToRemove.id);
          this.alertService.success('Removed prerequisite', 4000);
          this.filterTaskDefs(this.searchText());
        },
        error: (error) => {
          this.alertService.error(`Failed to remove prerequisite: ${error}`, 6000);
        },
      });
  }
}
