import {addWeeks} from 'date-fns';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {ErrorStateMatcher} from '@angular/material/core';
import {MatTableDataSource} from '@angular/material/table';
import {Subscription} from 'rxjs';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {GradeDefinition, Unit} from 'src/app/api/models/unit';
import {FeedbackTemplateService} from 'src/app/api/services/feedback-template.service';
import {TaskDefinitionService} from 'src/app/api/services/task-definition.service';
import {UnitService} from 'src/app/api/services/unit.service';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {
  CsvResult,
  CsvResultModalService,
} from 'src/app/common/modals/csv-result-modal/csv-result-modal.service';
import {CsvUploadModalService} from 'src/app/common/modals/csv-upload-modal/csv-upload-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {
  rememberSavedTaskDefinition,
  restoreTaskDefinition,
  savedTaskDefinitionCopy,
} from './task-definition-snapshot';

@Component({
  selector: 'f-unit-task-editor',
  templateUrl: 'unit-task-editor.component.html',
  styleUrls: ['unit-task-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class UnitTaskEditorComponent implements OnInit, OnDestroy {
  @Input() unit: Unit;
  @ViewChild('editorColumn') editorColumn?: ElementRef<HTMLElement>;

  public taskDefinitionSource: MatTableDataSource<TaskDefinition> = new MatTableDataSource([]);
  public filter: string = '';
  public selectedTaskDefinition: TaskDefinition;
  public isTaskListCollapsed: boolean = false;
  public savingTaskDefinition: boolean = false;

  public manageDueDates: boolean = false;

  // One matcher per date cell, kept so the field is not handed a new object on
  // every check, which would make Material recompute its error state each time.
  private readonly dateOrderMatchers: WeakMap<TaskDefinition, Map<number, ErrorStateMatcher>> =
    new WeakMap();

  public get gradeColumns(): GradeDefinition[] {
    return this.unit.gradeDefinitions.filter((definition) => definition.value >= 0);
  }

  public get dueDateColumns(): string[] {
    return [
      'taskDefinition',
      ...this.gradeColumns.map((definition) => this.gradeColumnId(definition)),
    ];
  }

  public get taskCountLabel(): string {
    const count = this.unit?.taskDefinitions.length ?? 0;
    return count === 1 ? '1 task' : `${count} tasks`;
  }

  public gradeColumnId(grade: GradeDefinition): string {
    return `grade-${grade.value}`;
  }

  public gradeLabel(taskDefinition: TaskDefinition): string {
    return this.unit.gradeLabel(taskDefinition.targetGrade) ?? '';
  }

  isStartAfterTarget(td: TaskDefinition, grade: GradeDefinition): boolean {
    const start = this.getGradeStartDate(td, grade);
    const target = this.getGradeDueDate(td, grade);
    if (!start || !target) {
      return false;
    }
    return new Date(start).getTime() > new Date(target).getTime();
  }

  /**
   * Puts both date fields of a cell into Material's error state when the start is
   * after the target, so the field draws its own red outline and label.
   */
  public dateOrderMatcher(td: TaskDefinition, grade: GradeDefinition): ErrorStateMatcher {
    let matchers = this.dateOrderMatchers.get(td);
    if (!matchers) {
      matchers = new Map();
      this.dateOrderMatchers.set(td, matchers);
    }

    let matcher = matchers.get(grade.value);
    if (!matcher) {
      matcher = {isErrorState: () => this.isStartAfterTarget(td, grade)};
      matchers.set(grade.value, matcher);
    }
    return matcher;
  }

  getGradeStartDate(td: TaskDefinition, grade: GradeDefinition): Date | null {
    return grade.value === 0 ? td.startDate : (td.gradeStartDate(grade.value) ?? td.startDate);
  }

  isFallbackStartDate(td: TaskDefinition, grade: GradeDefinition): boolean {
    return grade.value !== 0 && !td.gradeStartDate(grade.value);
  }

  setGradeStartDate(td: TaskDefinition, grade: GradeDefinition, value: Date | null): void {
    // The first grade holds the task's own dates, which cannot be empty. Clearing
    // a later grade is fine: it goes back to using the task's own date.
    if (grade.value === 0 && !value) {
      return;
    }
    td.setGradeStartDate(grade.value, value);
    this.saveTaskDefinition(td);
  }

  getGradeDueDate(td: TaskDefinition, grade: GradeDefinition): Date | null {
    return grade.value === 0 ? td.targetDate : (td.gradeTargetDate(grade.value) ?? td.targetDate);
  }

  isFallbackTargetDate(td: TaskDefinition, grade: GradeDefinition): boolean {
    return grade.value !== 0 && !td.gradeTargetDate(grade.value);
  }

  setGradeDueDate(td: TaskDefinition, grade: GradeDefinition, value: Date | null): void {
    if (grade.value === 0 && !value) {
      return;
    }
    td.setGradeTargetDate(grade.value, value);
    this.saveTaskDefinition(td);
  }

  constructor(
    private taskDefinitionService: TaskDefinitionService,
    private feedbackTemplateService: FeedbackTemplateService,
    private alerts: AlertService,
    private csvResultModalService: CsvResultModalService,
    private csvUploadModal: CsvUploadModalService,
    private confirmationModal: ConfirmationModalService,
    private unitService: UnitService,
  ) {
    // A task with no name or code yet must not stop the search from working.
    this.taskDefinitionSource.filterPredicate = (data: TaskDefinition, filter: string) =>
      [data.abbreviation, data.name].some((value) => (value ?? '').toLowerCase().includes(filter));
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.unit.taskDefinitionCache.values.subscribe((taskDefinitions) => {
        this.taskDefinitionSource.data = taskDefinitions;

        // A deleted task must not stay open in the editor.
        const selected = this.selectedTaskDefinition;
        if (selected && !selected.isNew && !taskDefinitions.includes(selected)) {
          this.selectedTaskDefinition = null;
        }
      }),
    );
  }

  public saveTaskDefinition(taskDefinition: TaskDefinition) {
    const isSelected = taskDefinition === this.selectedTaskDefinition;
    if (isSelected) {
      this.savingTaskDefinition = true;
    }

    taskDefinition.save().subscribe({
      next: () => {
        this.alerts.success('Task saved');
        taskDefinition.setOriginalSaveData(this.taskDefinitionService.mapping);
        rememberSavedTaskDefinition(taskDefinition);
        if (taskDefinition === this.selectedTaskDefinition) {
          this.savingTaskDefinition = false;
        }
      },
      error: (error) => {
        if (taskDefinition === this.selectedTaskDefinition) {
          this.savingTaskDefinition = false;
        }
        this.alerts.error(`Failed to save the task: ${error}`, 6000);
      },
    });
  }

  private subscriptions: Subscription[] = [];
  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  public selectTaskDefinition(taskDefinition: TaskDefinition) {
    // Clicking the task that is already open is not a discard, so it must not
    // ask. Keep this ahead of the guard.
    if (this.selectedTaskDefinition === taskDefinition) {
      return;
    }

    this.confirmDiscardingUnsavedTask(() => this.applySelectedTaskDefinition(taskDefinition));
  }

  private applySelectedTaskDefinition(taskDefinition: TaskDefinition) {
    this.selectedTaskDefinition = taskDefinition;
    this.savingTaskDefinition = false;

    // Record original save data if none present
    if (!this.selectedTaskDefinition.hasOriginalSaveData) {
      this.selectedTaskDefinition.setOriginalSaveData(this.taskDefinitionService.mapping);
    }
    // Only the first time: after that the copy is the last saved state, and this
    // task may still carry edits from an earlier visit to the tab.
    if (!savedTaskDefinitionCopy(taskDefinition)) {
      rememberSavedTaskDefinition(taskDefinition);
    }

    this.feedbackTemplateService
      .query({contextType: 'task_definitions', contextId: this.selectedTaskDefinition.id}, {})
      .subscribe({
        error: () => this.alerts.error('Error loading task feedback templates.'),
      });

    this.revealEditorOnSmallScreens();
  }

  // On a phone the editor sits below the list, so picking a task scrolls to it.
  private revealEditorOnSmallScreens() {
    if (typeof window === 'undefined' || !window.matchMedia?.('(max-width: 767px)').matches) {
      return;
    }
    setTimeout(() => this.editorColumn?.nativeElement.scrollIntoView({block: 'start'}));
  }

  // A task being edited is unsaved if it has never been saved at all, or if it
  // has been changed since it was loaded.
  //
  // isNew has to be tested and it has to come first. TaskDefinition.hasChanges
  // returns false when there is no originalSaveData, and only selectTaskDefinition
  // and a successful save ever set that, so a brand new task with every field
  // filled in reports no changes whatsoever. A guard built on hasChanges alone
  // protects the case that was already safe and leaves this one exactly as it was.
  private hasUnsavedTaskDefinition(): boolean {
    const selected = this.selectedTaskDefinition;
    return !!selected && (selected.isNew || this.taskDefinitionHasChanges(selected));
  }

  public get selectedTaskDefinitionHasChanges(): boolean {
    return this.hasUnsavedTaskDefinition();
  }

  private confirmDiscardingUnsavedTask(proceed: () => void) {
    if (!this.hasUnsavedTaskDefinition()) {
      proceed();
      return;
    }

    this.confirmationModal.show(
      'Discard unsaved changes',
      'This task has unsaved changes. If you continue, they will be lost.',
      () => {
        // The edits live on the task object itself, so they have to be undone
        // here. Without this they stayed in memory, showed up elsewhere in the
        // app and went to the server with the next save of this task.
        this.revertSelectedTaskDefinition();
        proceed();
      },
    );
  }

  private revertSelectedTaskDefinition() {
    const selected = this.selectedTaskDefinition;
    const savedCopy = selected && !selected.isNew && savedTaskDefinitionCopy(selected);
    if (!savedCopy) {
      return;
    }

    restoreTaskDefinition(selected, savedCopy);
    selected.setOriginalSaveData(this.taskDefinitionService.mapping);
  }

  /** Throw away the edits to the open task, or the whole task if it was never saved. */
  public discardTaskDefinitionChanges(): void {
    const selected = this.selectedTaskDefinition;
    if (!selected) {
      return;
    }

    this.confirmDiscardingUnsavedTask(() => {
      if (selected.isNew) {
        this.selectedTaskDefinition = null;
      }
    });
  }

  public isSelectedTaskDefinition(taskDefinition: TaskDefinition): boolean {
    return this.selectedTaskDefinition === taskDefinition;
  }

  public toggleTaskListCollapsed(): void {
    this.isTaskListCollapsed = !this.isTaskListCollapsed;
  }

  applyFilter(filterValue: string) {
    if (!this.taskDefinitionSource) {
      return;
    }

    this.taskDefinitionSource.filter = filterValue.trim().toLowerCase();

    // No dialog here on purpose. The box is [(ngModel)] bound and this runs from
    // ngModelChange, so the character is already typed by the time we see it, and
    // cancelling would mean writing the text back one keystroke at a time while
    // the convenor answers a modal per letter. Filtering the list underneath an
    // open editor is the behaviour that was wanted anyway.
    if (this.hasUnsavedTaskDefinition()) {
      return;
    }

    this.selectedTaskDefinition = null;
  }

  private guessTaskAbbreviation() {
    if (this.unit.taskDefinitions.length == 0) {
      return '1.1P';
    } else {
      const lastAbbr = this.unit.taskDefinitions[this.unit.taskDefinitions.length - 1].abbreviation;
      const regex = /(.*)(\d+)(\D*)/;
      const match = regex.exec(lastAbbr);
      if (match) {
        return `${match[1]}${parseInt(match[2]) + 1}${match[3]}`;
      } else {
        return `${lastAbbr}1`;
      }
    }
  }

  public taskDefinitionHasChanges(taskDefinition: TaskDefinition): boolean {
    return taskDefinition.hasChanges(this.taskDefinitionService.mapping);
  }

  public deleteTaskDefinition(taskDefinition: TaskDefinition) {
    // A task that was never saved has nothing on the server to delete. Asking the
    // server anyway sent a request with no id and showed an error.
    if (taskDefinition.isNew) {
      this.discardTaskDefinitionChanges();
      return;
    }

    this.confirmationModal.show(
      `Delete task ${taskDefinition.abbreviation}`,
      'This deletes the task and all the work students have submitted for it. You cannot undo this.',
      () => {
        this.unit.deleteTaskDefinition(taskDefinition);
        //TODO: reinstate ProgressModal.show "Deleting Task #{task.abbreviation}", 'Please wait while student projects are updated.', promise
      },
    );
  }

  // An import reloads the unit, and the reload writes the server's copy over every
  // task, the open one included. So any unsaved edits go first, with a warning.
  public uploadTaskDefinitionsCsv() {
    this.confirmDiscardingUnsavedTask(() =>
      this.csvUploadModal.show(
        'Upload task list',
        'Upload a CSV of task definitions.',
        {file: {name: 'Task Definition CSV Data', type: 'csv'}},
        this.unit.getTaskDefinitionBatchUploadUrl(),
        (response: CsvResult) => {
          // at least one student?
          this.csvResultModalService.show('Task list import results', response);
          if (response.success.length > 0) {
            this.reloadUnitAfterImport();
          }
        },
      ),
    );
  }

  public uploadTaskResourcesZip() {
    this.confirmDiscardingUnsavedTask(() =>
      this.csvUploadModal.show(
        'Upload task sheets and resources',
        'Upload a ZIP of task sheets and resources.',
        {file: {name: 'Task Sheets and Resources', type: 'zip'}},
        this.unit.taskUploadUrl,
        (response: CsvResult) => {
          // at least one student?
          this.csvResultModalService.show('Task sheet and resource import results', response);
          if (response.success.length > 0) {
            this.reloadUnitAfterImport();
          }
        },
      ),
    );
  }

  // The reload updates each task in place with what the server now holds, so
  // that is the new saved state: the copy Discard goes back to, and what unsaved
  // changes are measured against. Without this Discard put back the values from
  // before the import.
  private reloadUnitAfterImport() {
    this.unitService.fetch(this.unit.id).subscribe({
      next: () => {
        for (const taskDefinition of this.unit.taskDefinitions) {
          taskDefinition.setOriginalSaveData(this.taskDefinitionService.mapping);
          rememberSavedTaskDefinition(taskDefinition);
        }
      },
      error: (message) => this.alerts.error(message, 6000),
    });
  }

  public createTaskDefinition() {
    this.confirmDiscardingUnsavedTask(() => this.buildNewTaskDefinition());
  }

  private buildNewTaskDefinition() {
    const abbr = this.guessTaskAbbreviation();
    const task = new TaskDefinition(this.unit);

    task.name = `Task ${abbr}`;
    task.abbreviation = abbr;
    task.description = 'New Description';
    task.startDate = new Date();
    task.targetDate = addWeeks(new Date(), 2);
    task.uploadRequirements = [];
    task.weighting = 4;
    task.targetGrade = 0;
    task.restrictStatusUpdates = false;
    task.plagiarismWarnPct = 80;
    task.isGraded = false;
    task.maxQualityPts = 0;
    task.tutorialStream = this.unit.tutorialStreams[0];

    this.selectedTaskDefinition = task;
    this.savingTaskDefinition = false;
    this.revealEditorOnSmallScreens();
  }
}
