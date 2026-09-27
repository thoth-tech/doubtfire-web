import {HotkeysService} from '@ngneat/hotkeys';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {ActivatedRoute, Router} from '@angular/router';
import {Observable, Subscription} from 'rxjs';
import {
  Project,
  Task,
  TaskDefinition,
  Tutorial,
  UserService,
} from 'src/app/api/models/doubtfire-model';
import {SidekiqJob} from 'src/app/api/models/sidekiq-job';
import {Unit} from 'src/app/api/models/unit';
import {UnitRole} from 'src/app/api/models/unit-role';
import {TaskDefinitionService} from 'src/app/api/services/task-definition.service';
import {AppInjector} from 'src/app/app-injector';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {TasksByTutorPipe} from 'src/app/common/filters/tasks-by-tutor.pipe';
import {TasksForInboxSearchPipe} from 'src/app/common/filters/tasks-for-inbox-search.pipe';
import {TasksInTutorialsPipe} from 'src/app/common/filters/tasks-in-tutorials.pipe';
import {TasksOfTaskDefinitionPipe} from 'src/app/common/filters/tasks-of-task-definition.pipe';
import {CsvResultModalService} from 'src/app/common/modals/csv-result-modal/csv-result-modal.service';
import {CsvUploadModalService} from 'src/app/common/modals/csv-upload-modal/csv-upload-modal.service';
import {SidekiqProgressModalService} from 'src/app/common/modals/sidekiq-progress-modal/sidekiq-progress-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {SelectedTaskService} from 'src/app/projects/states/dashboard/selected-task.service';
import {BatchFeedbackWorkflowDialogComponent} from './batch-feedback-workflow-dialog/batch-feedback-workflow-dialog.component';

export interface StaffTaskListEmptyState {
  icon: string;
  message: string;
  hint: string;
  action: 'clear-search' | 'all-students' | 'refresh' | null;
  actionLabel?: string;
}

@Component({
  selector: 'df-staff-task-list',
  templateUrl: './staff-task-list.component.html',
  styleUrls: ['./staff-task-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class StaffTaskListComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('searchDialog') searchDialog: TemplateRef<object>;

  private taskRequestSub?: Subscription;

  @Input() task: Task;
  @Input() project: Project;

  @Input() taskData: {
    source: (
      unit: Unit,
      taskDef?: TaskDefinition | number,
      fetchMyStudentsOnly?: boolean,
    ) => Observable<Task[]>;
    selectedTask: Task | null;
    taskKey: unknown;
    onSelectedTaskChange: (task: Task | null) => void;
    taskDefMode: boolean;
  };
  @Input() unit: Unit;
  @Input() unitRole: UnitRole;
  @Input() filters: Partial<{
    taskDefinition: TaskDefinition;
    tutorials: Tutorial[];
    forceStream: boolean;
    studentName: string;
    tutorialIdSelected: string | number;
    unitRoleIdSelected: number | string;
    taskDefinitionIdSelected: number | TaskDefinition;
  }>;
  @Input() showSearchOptions = true;

  @Input() isNarrow: boolean;

  @Input() viewType: 'inbox' | 'explorer' | 'moderation' | 'overflow';

  userHasTutorials: boolean;
  filteredTasks: Task[] = null;

  studentFilter: {
    id: number | string;
    inboxDescription: string;
    abbreviation: string;
    forceStream: boolean;
    tutorial?: Tutorial;
  }[] = null;

  tutorGroups: {
    label: string;
    options: {id: string | number; inboxDescription: string | undefined}[];
  }[] = [];

  tasks: Task[] = null;

  // hasJplagReport: boolean = false;

  watchingTaskKey: boolean;

  panelOpenState = false;
  loading = true;
  /** The last task query failed, so the list offers a retry instead of a blank panel. */
  loadError = false;

  // The list is drawn twice, once for wide screens and once for phones, so each copy
  // needs its own id for the filter toggle to point at.
  private static nextInstanceId = 0;
  readonly filtersPanelId = `staff-task-filters-${StaffTaskListComponent.nextInstanceId++}`;

  definedTasksPipe = new TasksOfTaskDefinitionPipe();
  tasksInTutorialsPipe = new TasksInTutorialsPipe();
  taskWithStudentNamePipe = new TasksForInboxSearchPipe();
  tasksByTutorPipe = new TasksByTutorPipe();
  // Let's call having a source of tasksForDefinition plus having a task definition
  // auto-selected with the search options open task def mode -- i.e., the mode
  // for selecting tasks by task definitions

  states = [
    {sort: 'default', icon: 'swap_vert', label: 'Sort by task'},
    {sort: 'ascending', icon: 'arrow_upward', label: 'Sorted by task, first to last'},
    {sort: 'descending', icon: 'arrow_downward', label: 'Sorted by task, last to first'},
  ];

  taskDefSort = 0;
  tutorialSort = 0;
  originalFilteredTasks: Task[] = null;
  allowHover = true;

  toggleTutorialSort() {
    this.tutorialSort = (this.tutorialSort + 1) % this.states.length;
  }

  // Track if all tasks have already been fetched
  // Avoids redundant API calls when changing tutorial filters
  fetchedAllTasks: boolean = false;

  constructor(
    private selectedTaskService: SelectedTaskService,
    private alertService: AlertService,
    private fileDownloaderService: FileDownloaderService,
    public dialog: MatDialog,
    private csvUploadModal: CsvUploadModalService,
    private csvResultModal: CsvResultModalService,
    private userService: UserService,
    private hotkeys: HotkeysService,
    private router: Router,
    private route: ActivatedRoute,
    private taskDefinitionService: TaskDefinitionService,
    private sidekiqProgressModalService: SidekiqProgressModalService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.taskData && !changes.taskData.isFirstChange() && this.tasks?.length) {
      this.setTaskDefFromTaskKey(this.taskData.taskKey);
      this.syncSelectedTaskFromTaskKey();
    }

    const unitChanged =
      !!changes.unit &&
      !changes.unit.isFirstChange() &&
      changes.unit.currentValue?.id &&
      changes.unit.previousValue?.id !== changes.unit.currentValue?.id;

    // This used to sit behind an isTaskDefMode guard, so the inbox kept the previous
    // unit's students, tutors and tasks on screen after a unit switch.
    if (unitChanged && this.unit && this.unitRole) {
      this.initialiseForUnit();
    }
  }

  ngOnDestroy(): void {
    this.taskRequestSub?.unsubscribe();
    this.hotkeys.removeShortcuts('control.shift.arrowdown');
    this.hotkeys.removeShortcuts('control.shift.arrowup');
  }

  ngOnInit(): void {
    const registeredHotkeys = this.hotkeys.getHotkeys().map((hotkey) => hotkey.keys);

    if (!registeredHotkeys.includes('control.shift.arrowdown')) {
      this.hotkeys
        .addShortcut({
          keys: 'control.shift.arrowdown',
          description: 'Select next task',
        })
        .subscribe(() => this.nextTask());
    }

    if (!registeredHotkeys.includes('control.shift.arrowup')) {
      this.hotkeys
        .addShortcut({
          keys: 'control.shift.arrowup',
          description: 'Select previous task',
        })
        .subscribe(() => this.previousTask());
    }

    // if device is movile always set hover to false
    // so you can instantly click on an item in the list
    if (navigator.maxTouchPoints > 1) {
      this.allowHover = false;
    }

    this.initialiseForUnit();
  }

  // The filter defaults, the student and tutor lists and the task query are all built
  // from the routed unit, so they have to be rebuilt when it changes. The router reuses
  // this component across a unit switch, so ngOnInit does not run a second time.
  private initialiseForUnit(): void {
    this.fetchedAllTasks = false;

    // Does the current user have any tutorials?
    this.userHasTutorials =
      this.unit.tutorialsForUserName(this.userService.currentUser.name)?.length > 0;

    const staff = this.unit.staff.slice();

    const byName = (a: UnitRole, b: UnitRole) =>
      (a.user?.name ?? '').localeCompare(b.user?.name ?? '');

    const mentored = staff
      .filter((ur) => ur.mentorId === this.unitRole.id)
      .slice()
      .sort(byName);

    const allTutors = staff.slice().sort(byName);
    const shouldDefaultToMyStudents =
      (this.unitRole.role === 'Tutor' || this.unitRole.role === 'Convenor') &&
      this.userHasTutorials;

    this.filters = Object.assign(
      {
        studentName: null,
        tutorialIdSelected: shouldDefaultToMyStudents ? 'mine' : 'all',
        tutorials: [],
        unitRoleIdSelected:
          mentored.length > 0 && this.viewType === 'moderation' ? 'mentoring_all' : 'all',
        taskDefinitionIdSelected: null,
        taskDefinition: null,
        forceStream: true,
      },
      this.filters,
    );

    this.studentFilter = [
      ...[
        {id: 'all', inboxDescription: 'All students', abbreviation: '__all', forceStream: false},
        {
          id: 'mine',
          inboxDescription: 'My students',
          abbreviation: '__mine',
          forceStream: !this.isTaskDefMode,
        },
      ],
      ...this.unit.tutorials.map((t) => {
        return {
          id: t.id,
          inboxDescription: `${t.abbreviation} - ${t.description}`,
          abbreviation: t.abbreviation,
          forceStream: true,
          tutorial: t,
        };
      }),
    ];
    this.tutorGroups = [
      ...(mentored.length > 0
        ? [
            {
              label: 'Tutors you mentor',
              options: [
                {id: 'mentoring_all', inboxDescription: 'All tutors you mentor'},
                ...mentored.map((ur) => ({
                  id: ur.id,
                  inboxDescription: ur.user?.name,
                })),
              ],
            },
          ]
        : []),
      {
        label: 'All tutors',
        options: [
          {id: 'all', inboxDescription: 'Any tutor'},
          ...allTutors.map((ur) => ({
            id: ur.id,
            inboxDescription: ur.user?.name,
          })),
        ],
      },
    ];

    this.tutorialIdChanged(false);

    this.setTaskDefFromTaskKey(this.taskData.taskKey);

    // Initially not watching the task key
    this.watchingTaskKey = false;

    this.refreshData();
  }

  public get isTaskDefMode(): boolean {
    return this.taskData.taskDefMode;
  }

  /** The page title, which names the queue the list is showing. */
  public get listTitle(): string {
    switch (this.viewType) {
      case 'explorer':
        return 'Task explorer';
      case 'moderation':
        return 'Moderation';
      case 'overflow':
        return 'Overflow';
      case 'inbox':
      default:
        return 'Task inbox';
    }
  }

  /** The muted line under the title: how many tasks the list holds right now. */
  public get listSummary(): string {
    if (this.loading) {
      return 'Loading tasks';
    }

    if (this.loadError || !this.filteredTasks) {
      return 'No tasks loaded';
    }

    const shown = this.filteredTasks.length;
    const total = this.tasks?.length ?? shown;
    const noun = (count: number) => (count === 1 ? 'task' : 'tasks');

    return shown === total ? `${shown} ${noun(shown)}` : `${shown} of ${total} ${noun(total)}`;
  }

  /** What an empty list says, and the one thing it offers to do about it. */
  public get emptyState(): StaffTaskListEmptyState {
    if (this.hasSearchText) {
      return {
        icon: 'search_off',
        message: 'No tasks match your search',
        hint: 'Try a different name or task code.',
        action: 'clear-search',
        actionLabel: 'Clear search',
      };
    }

    const someStudentsOnly = this.filters?.tutorialIdSelected !== 'all';

    switch (this.viewType) {
      case 'explorer':
        if (!this.unit?.taskDefinitions?.length) {
          return {
            icon: 'assignment',
            message: 'This unit has no tasks yet',
            hint: 'Tasks show up here once they are added to the unit.',
            action: null,
          };
        }
        return someStudentsOnly
          ? {
              icon: 'group_off',
              message: 'No students to show',
              hint: 'None of the students in this filter have this task.',
              action: 'all-students',
              actionLabel: 'Show all students',
            }
          : {
              icon: 'group_off',
              message: 'No students to show',
              hint: 'No students are enrolled in this unit yet.',
              action: null,
            };
      case 'moderation':
        return {
          icon: 'verified',
          message: 'Nothing to moderate',
          hint: 'Tasks picked for moderation show up here.',
          action: 'refresh',
          actionLabel: 'Refresh',
        };
      case 'overflow':
        return {
          icon: 'more_time',
          message: 'No overflow tasks',
          hint: 'Tasks that have waited too long for feedback show up here.',
          action: 'refresh',
          actionLabel: 'Refresh',
        };
      case 'inbox':
      default:
        return someStudentsOnly
          ? {
              icon: 'done_all',
              message: 'You are all caught up',
              hint: 'None of these students have tasks waiting for you.',
              action: 'all-students',
              actionLabel: 'Show all students',
            }
          : {
              icon: 'done_all',
              message: 'You are all caught up',
              hint: 'No tasks are waiting for feedback.',
              action: 'refresh',
              actionLabel: 'Refresh',
            };
    }
  }

  public runEmptyStateAction(action: StaffTaskListEmptyState['action']): void {
    switch (action) {
      case 'clear-search':
        this.clearSearch();
        break;
      case 'all-students':
        this.showAllStudents();
        break;
      case 'refresh':
        this.refreshTasks();
        break;
    }
  }

  public get hasSearchText(): boolean {
    return !!this.filters?.studentName?.trim();
  }

  public get taskSortLabel(): string {
    return this.states[this.taskDefSort].label;
  }

  public clearSearch(): void {
    this.filters.studentName = null;
    this.applyFilters();
  }

  public showAllStudents(): void {
    this.tutorialIdChanged(true, 'all');
  }

  /**
   * The collapsed list shows only the avatar, so its button carries the student, the
   * task and anything that needs attention in its name and tooltip.
   */
  public narrowRowLabel(task: Task): string {
    const student = task.project?.student;
    const parts = [student?.displayName || student?.name, task.definition?.abbreviation];
    if (task.numNewComments > 0) {
      parts.push(`${task.numNewComments} new comment${task.numNewComments === 1 ? '' : 's'}`);
    }
    if (task.similaritiesDetected) {
      parts.push('similarities detected');
    }

    return parts.filter(Boolean).join(', ');
  }

  /** How long the task has waited, for the warning beside the student's name. */
  public waitingLabel(task: Task): string {
    const days = task.daysSinceSubmission();
    const waited = `Waiting ${days} ${days === 1 ? 'day' : 'days'} for feedback`;

    return this.getWarningIcon(task) === 'overflow'
      ? `${waited}. Feedback is overdue.`
      : `${waited}. Feedback is due soon.`;
  }

  downloadSubmissionPdfs() {
    const taskDef = this.filters.taskDefinition;
    this.taskDefinitionService.zipSubmissionPdfs(taskDef).subscribe({
      next: (newJob) => {
        this.sidekiqProgressModalService
          .show(`Downloading submission pdfs for ${taskDef.abbreviation}`, newJob.id)
          .subscribe({
            next: (_job) => {
              this.fileDownloaderService.downloadFile(
                `${AppInjector.get(DoubtfireConstants).API_URL}/submission/unit/${
                  this.unit.id
                }/task_definitions/${taskDef.id}/student_pdfs`,
                `${this.unit.code}-${taskDef.abbreviation}-pdfs.zip`,
              );
            },
          });
      },
      error: (error) => {
        this.alertService.error(error, 6000);
      },
    });
  }

  downloadSubmissionFiles() {
    const taskDef = this.filters.taskDefinition;
    this.taskDefinitionService.zipSubmissionFiles(taskDef).subscribe({
      next: (newJob) => {
        this.sidekiqProgressModalService
          .show(`Downloading submission files for ${taskDef.abbreviation}`, newJob.id)
          .subscribe({
            next: (_job) => {
              this.fileDownloaderService.downloadFile(
                `${AppInjector.get(DoubtfireConstants).API_URL}/submission/unit/${
                  this.unit.id
                }/task_definitions/${taskDef.id}/download_submissions`,
                `${this.unit.code}-${taskDef.abbreviation}-submissions.zip`,
              );
            },
          });
      },
      error: (error) => {
        this.alertService.error(error, 6000);
      },
    });
  }

  openBatchFeedbackDialog() {
    const taskDefinition = this.filters.taskDefinition ?? undefined;

    if (!taskDefinition) {
      this.alertService.error('Choose a task before uploading batch feedback.', 5000);
      return;
    }

    const dialogRef = this.dialog.open(BatchFeedbackWorkflowDialogComponent, {
      width: '100%',
      maxWidth: '840px',
      data: {
        unit: this.unit,
        taskDefinition,
        myStudentsOnly: this.filters.tutorialIdSelected === 'mine',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result?.openUpload) {
        return;
      }

      this.csvUploadModal.show(
        `Upload ${taskDefinition.abbreviation} Batch Feedback Zip`,
        '',
        {
          file: {name: 'Batch Feedback Zip', type: 'zip'},
        },
        this.unit.getBatchFeedbackUploadUrl(taskDefinition),
        (response: SidekiqJob) => {
          if (!response?.id) {
            this.alertService.error('Batch feedback upload failed.', 6000);
            return;
          }

          this.sidekiqProgressModalService
            .show(`Uploading ${taskDefinition.abbreviation} Batch Feedback`, response.id)
            .subscribe({
              next: (job) => {
                this.csvResultModal.show('Batch Feedback Upload Results', JSON.parse(job.result));
                this.refreshData();
              },
              error: (error) => {
                console.error(error);
                this.alertService.error('Batch feedback upload failed.', 6000);
              },
            });
        },
      );
    });
  }

  downloadJPLAGReport() {
    const taskDef = this.filters.taskDefinition;
    this.fileDownloaderService.downloadFile(
      taskDef.getJplagReportUrl(),
      `${this.unit.code}-${taskDef.abbreviation}-jplag-report.zip`,
    );

    const url = this.router.serializeUrl(this.router.createUrlTree(['/jplag-report-viewer']));
    window.open(url, '_blank');
  }

  openDialog() {
    const dialogRef = this.dialog.open(this.searchDialog);

    dialogRef.afterClosed().subscribe();
  }

  refreshTasks(): void {
    this.refreshData();
  }

  applyFilters() {
    let filteredTasks = this.definedTasksPipe.transform(this.tasks, this.filters.taskDefinition);
    if (this.filters.tutorials) {
      filteredTasks = this.tasksInTutorialsPipe.transform(
        filteredTasks,
        this.filters.tutorials.map((t) => t.id),
        this.filters.forceStream,
      );
    }

    if (this.filters.unitRoleIdSelected) {
      filteredTasks = this.tasksByTutorPipe.transform(
        this.unitRole,
        filteredTasks,
        this.filters.unitRoleIdSelected,
      );
    }

    filteredTasks = this.taskWithStudentNamePipe.transform(filteredTasks, this.filters.studentName);
    filteredTasks = this.sortPinnedTasksFirst(filteredTasks);
    this.filteredTasks = filteredTasks;

    if (this.filteredTasks != null) {
      this.originalFilteredTasks = [...this.filteredTasks];
    }

    this.taskDefSort = 0;
    this.tutorialSort = 0;

    // Clear selected task only when the active filters hide it.
    if (
      this.taskData.selectedTask &&
      !filteredTasks?.some((task) => task?.hasTaskKey(this.taskData.selectedTask.taskKey()))
    ) {
      this.setSelectedTask(null);
    }
  }

  unitRoleIdChanged(attemptRefreshData: boolean = true): void {
    this.applyFilters();

    const isExplorerView = this.isTaskDefMode;
    if (attemptRefreshData && !this.fetchedAllTasks && !isExplorerView) {
      this.refreshData();
    }
  }

  tutorialIdChanged(
    attemptRefreshData: boolean = true,
    selectedTutorialId: string | number = this.filters.tutorialIdSelected,
  ): void {
    this.filters.tutorialIdSelected = selectedTutorialId;
    const tutorialId = selectedTutorialId;

    if (attemptRefreshData) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {students: tutorialId},
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    const filterOption = this.studentFilter.find((f) => String(f.id) === String(tutorialId));

    if (!filterOption) {
      return;
    }

    this.filters.forceStream = filterOption.forceStream;

    if (tutorialId === 'mine') {
      this.filters.tutorials = this.unit.tutorialsForUserName(this.userService.currentUser.name);
      this.filters.unitRoleIdSelected = 'all';
    } else if (tutorialId === 'all') {
      // Ignore tutorials filter
      this.filters.tutorials = null;
    } else {
      this.filters.tutorials = [filterOption.tutorial];
      this.filters.unitRoleIdSelected = 'all';
    }

    this.applyFilters();

    const isExplorerView = this.isTaskDefMode;
    if (attemptRefreshData && !this.fetchedAllTasks && !isExplorerView) {
      this.refreshData();
    }
  }

  //  Task definition options
  taskDefinitionIdChanged() {
    let taskDef;
    const taskDefId = this.filters.taskDefinitionIdSelected;
    if (taskDefId) {
      taskDef = taskDefId instanceof TaskDefinition ? taskDefId : this.unit.taskDef(taskDefId);
    } else {
      taskDef = null;
    }
    this.filters.taskDefinition = taskDef;
    if (this.isTaskDefMode) {
      this.refreshData();
    }
    this.applyFilters();
  }

  private setTaskDefFromTaskKey(taskKey) {
    // Only applicable in taskDefMode
    if (!this.isTaskDefMode) {
      return;
    }
    const taskDef =
      this.unit.taskDefinitionCache.currentValues.find(
        (x) => x.abbreviation === taskKey?.taskDefAbbr,
      ) || this.unit.taskDefinitionCache.currentValues[0];
    // A unit with no tasks yet has nothing to explore, and reading the id of the
    // missing first task used to stop the explorer before it could say so.
    if (!taskDef) {
      return;
    }
    this.filters.taskDefinitionIdSelected = taskDef.id;
    this.filters.taskDefinition = taskDef;
  }

  // Finds a task (or null) given its task key
  private findTaskForTaskKey(key): Task {
    return this.tasks.find((t) => t?.hasTaskKey(key));
  }

  private syncSelectedTaskFromTaskKey(): void {
    if (!this.tasks?.length) {
      return;
    }

    if (!this.taskData.taskKey) {
      this.setSelectedTask(null);
      return;
    }

    const task = this.findTaskForTaskKey(this.taskData.taskKey);
    if (task) {
      this.setSelectedTask(task);
    }
  }

  // Callback to refresh data from the task source
  private refreshData() {
    const fetchMyStudentsOnly = this.filters.tutorialIdSelected === 'mine';

    // The explorer asks for one task's submissions. A unit with no tasks has none to
    // ask for, and the request it used to send named a task that does not exist.
    if (this.isTaskDefMode && !this.filters?.taskDefinitionIdSelected) {
      this.taskRequestSub?.unsubscribe();
      this.tasks = [];
      this.applyFilters();
      this.loading = false;
      this.loadError = false;
      return;
    }

    this.loading = true;
    this.loadError = false;
    // A unit or filter change can start a second query before the previous one
    // returns. Cancel the older query so it cannot land late and put stale tasks
    // back on screen after the component has moved to the new unit.
    this.taskRequestSub?.unsubscribe();
    // Tasks for feedback or tasks for task, depending on the data source
    this.taskRequestSub = this.taskData
      .source(this.unit, this.filters?.taskDefinitionIdSelected, fetchMyStudentsOnly)
      .subscribe({
        next: (response) => {
          this.tasks = response;
          this.applyFilters();
          this.loading = false;
          this.loadError = false;

          this.fetchedAllTasks = !fetchMyStudentsOnly && !this.isTaskDefMode;

          // If the URL carries a task key, load that task once the query results arrive.
          this.syncSelectedTaskFromTaskKey();

          // For when URL has been manually changed, set the selected task
          // using new array of tasks loaded from the new taskKey
          if (!this.watchingTaskKey) {
            this.watchingTaskKey = true;
          }
        },
        error: (message) => {
          this.alertService.error(message, 6000);
          this.loading = false;
          this.loadError = true;
        },
      });
  }

  /**
   * The task whose row actions are being held open by keyboard focus, if any. Focus is
   * tracked separately from task.hover so that neither path can close the other: tabbing
   * away used to run the same handler as mouseout and would fade the options button out
   * from under a pointer that was still sitting on the row.
   */
  focusedTaskId: number | null = null;

  /**
   * Reveal the row actions because the pointer is over the row. Touch devices opt out
   * of hover entirely via allowHover, which is why this is not simply `true`.
   */
  showTaskActionsForPointer(task: Task) {
    task.hover = this.allowHover;
  }

  /**
   * Hide the row actions again once the pointer leaves. This is the original mouseout
   * behaviour and it deliberately touches nothing the keyboard owns.
   */
  hideTaskActions(task: Task) {
    task.hover = task.optionsOpened;
  }

  /**
   * Reveal the row actions because the submission options button took keyboard focus.
   * Unlike the pointer path this always applies, since a keyboard is usable on a touch
   * device even when hover is not.
   */
  showTaskActionsForFocus(task: Task) {
    this.focusedTaskId = task.id;
  }

  /**
   * Release the keyboard's hold on the row. Another row may already have claimed focus
   * by the time this runs, so only the row that took it can give it back.
   */
  hideTaskActionsForFocus(task: Task) {
    if (this.focusedTaskId === task.id) {
      this.focusedTaskId = null;
    }
  }

  /**
   * Whether the row is showing its submission options in place of the pin indicator. Any
   * one of the three reasons is enough: the pointer is on the row, the keyboard is on the
   * options button, or the overflow menu it opened is still up. The menu case has to be
   * here as well as in the pointer path, because opening the menu from the keyboard moves
   * focus into the menu and so blurs the button that opened it.
   */
  rowActionsShown(task: Task): boolean {
    return task.hover || task.optionsOpened || this.focusedTaskId === task.id;
  }

  setSelectedTask(task: Task) {
    this.selectedTaskService.setSelectedTask(task);
    this.taskData.selectedTask = task;
    if (this.taskData.onSelectedTaskChange) {
      this.taskData.onSelectedTaskChange(task);
    }
    if (task) {
      this.scrollToTaskInList(task);
    }
  }

  private scrollToTaskInList(task: Task) {
    const taskEl = document.querySelector(`#${task.taskKeyToIdString()}`) as
      | (HTMLElement & {
          scrollIntoViewIfNeeded?: (options?: ScrollIntoViewOptions) => void;
        })
      | null;
    if (!taskEl) {
      return;
    }
    if (taskEl.scrollIntoViewIfNeeded) {
      taskEl.scrollIntoViewIfNeeded({behavior: 'smooth'});
    } else {
      taskEl.scrollIntoView({behavior: 'smooth'});
    }
  }

  isSelectedTask(task: Task) {
    const sameProject = this.taskData.selectedTask?.project.id === task.project.id;
    const sameTaskDef = this.taskData.selectedTask?.definition.id === task.definition.id;
    return sameProject && sameTaskDef;
  }

  nextTask(): void {
    if (!this.filteredTasks) {
      return;
    }
    const currentTaskIndex = this.filteredTasks.findIndex((task) => this.isSelectedTask(task));
    if (currentTaskIndex >= this.filteredTasks.length) {
      return;
    }
    const newTask = this.filteredTasks[currentTaskIndex + 1];
    if (newTask) {
      this.setSelectedTask(newTask);
    }
  }

  previousTask(): void {
    // The shortcut is live before the first query returns.
    if (!this.filteredTasks) {
      return;
    }
    const currentTaskIndex = this.filteredTasks.findIndex((task) => this.isSelectedTask(task));
    if (currentTaskIndex <= 0) {
      return;
    }
    const newTask = this.filteredTasks[currentTaskIndex - 1];
    if (newTask) {
      this.setSelectedTask(newTask);
    }
  }

  toggleTaskDefSort() {
    this.taskDefSort = this.taskDefSort < 2 ? ++this.taskDefSort : 0;
    if (this.originalFilteredTasks == null) {
      this.originalFilteredTasks = [...this.filteredTasks];
    }
    if (this.states[this.taskDefSort].sort == 'ascending') {
      this.filteredTasks = [
        ...this.filteredTasks.sort((a, b) => a.definition.seq - b.definition.seq),
      ];
    } else if (this.states[this.taskDefSort].sort == 'descending') {
      this.filteredTasks = [
        ...this.filteredTasks.sort((a, b) => b.definition.seq - a.definition.seq),
      ];
    } else {
      this.filteredTasks = [...this.originalFilteredTasks];
    }
  }

  togglePin(task: Task) {
    if (task.id === undefined) {
      // Can't pin a task that doesn't actually exist yet
      this.alertService.error(`This task can't be pinned yet`, 3000);
      return;
    }
    const refreshOrdering = () => this.applyFilters();
    if (task.pinned) {
      task.unpin(refreshOrdering);
    } else {
      task.pin(refreshOrdering);
    }
  }

  getWarningIcon(task: Task): 'warning' | 'overflow' | null {
    if (!task.submissionDate) {
      return null;
    }
    if (task.status !== 'ready_for_feedback') {
      return null;
    }

    const daysSinceSubmission = task.daysSinceSubmission();

    if (daysSinceSubmission >= task.unit.feedbackOverflowThresholdDays) {
      return 'overflow';
    }

    if (daysSinceSubmission >= task.unit.feedbackWarningThresholdDays) {
      return 'warning';
    }

    return null;
  }

  private sortPinnedTasksFirst(tasks: Task[]): Task[] {
    if (!this.isTaskDefMode || !tasks?.length) {
      return tasks;
    }

    return [...tasks].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }
}
