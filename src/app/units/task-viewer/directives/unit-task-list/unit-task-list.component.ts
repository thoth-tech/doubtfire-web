import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {BehaviorSubject, Subject, takeUntil} from 'rxjs';
import {
  Project,
  Task,
  TaskDefinition,
  TaskStatus,
  TaskStatusEnum,
} from 'src/app/api/models/doubtfire-model';
import {UserService} from 'src/app/api/services/user.service';
import {TaskDefinitionNamePipe} from 'src/app/common/filters/task-definition-name.pipe';

type TaskListSortOption = 'default' | 'abbreviation' | 'targetDate' | 'startDate' | 'dueDate';

type TaskListSortDirection = 'asc' | 'desc';

interface TaskListViewPreferences {
  sortBy: TaskListSortOption;
  sortDirection: TaskListSortDirection;
  hideCompleted: boolean;
  showAboveTargetGrade: boolean;
}

interface TaskListSortOptionView {
  value: TaskListSortOption;
  label: string;
  icon: string;
}

const DEFAULT_VIEW_PREFERENCES: TaskListViewPreferences = {
  sortBy: 'default',
  sortDirection: 'asc',
  hideCompleted: false,
  showAboveTargetGrade: false,
};

const START_APPROACHING_DAYS = 7;

@Component({
  selector: 'f-unit-task-list',
  templateUrl: './unit-task-list.component.html',
  styleUrls: ['./unit-task-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class FUnitTaskListComponent implements OnChanges, OnInit, OnDestroy {
  private readonly destroy$: Subject<void> = new Subject();
  private routeTaskAbbreviation: string | null = null;

  @Input() mode: 'project' | 'all-tasks';
  @Input() project: Project;
  @Input() targetGrade: number;
  @Input() taskDefinitions: readonly TaskDefinition[];
  @Input() tasks: readonly Task[];
  @Input() isCollapsed = false;
  @Input() selectionUrlBase: unknown[] | null = null;

  @HostBinding('class.collapsed')
  public get collapsedHostClass(): boolean {
    return this.isCollapsed;
  }

  // What is the selected task definition
  @Input() selectedTaskDefinition$: BehaviorSubject<TaskDefinition>;
  selectedTaskDef: TaskDefinition;

  filteredTaskDefinitions: TaskDefinition[]; // list of tasks which match the taskSearch term
  searchText: string = ''; // task search term from user input
  activeStatusFilter: TaskStatusEnum | null = null;
  taskDefinitionNamePipe = new TaskDefinitionNamePipe();
  viewPreferences: TaskListViewPreferences = {...DEFAULT_VIEW_PREFERENCES};
  sortOptions: TaskListSortOptionView[] = [
    {value: 'default', label: 'Priority', icon: 'sort'},
    {value: 'startDate', label: 'Start date', icon: 'event_available'},
    {value: 'targetDate', label: 'Target date', icon: 'event'},
    {value: 'dueDate', label: 'Due date', icon: 'event_repeat'},
    {value: 'abbreviation', label: 'Abbreviation', icon: 'sort_by_alpha'},
  ];
  readonly statusOptions = TaskStatus.PEER_PROGRESS_DISPLAY_ORDER.map((status) => ({
    status,
    label: TaskStatus.STATUS_LABELS.get(status) ?? status,
  }));

  protected get gradeNames(): Record<number, string> {
    const unit = this.project?.unit ?? this.taskDefinitions?.[0]?.unit;
    return Object.fromEntries(
      (unit?.gradeDefinitions ?? []).map((definition) => [definition.value, definition.label]),
    );
  }

  constructor(
    private angularRouter: Router,
    private route: ActivatedRoute,
    private userService: UserService,
  ) {}

  applyFilters() {
    this.refreshTopTaskWeights();

    const matchingTaskDefinitions = this.taskDefinitionNamePipe.transform(
      this.taskDefinitions,
      this.searchText,
    );

    this.filteredTaskDefinitions = matchingTaskDefinitions
      .filter((taskDef) => this.matchesStatusFilter(taskDef))
      .filter((taskDef) => this.shouldShowTaskDefinition(taskDef))
      .sort((a, b) => this.compareTaskDefinitions(a, b));

    this.deselectHiddenTaskDefinition();
  }

  public clearSearch(): void {
    if (!this.searchText) {
      return;
    }

    this.searchText = '';
    this.applyFilters();
  }

  public setStatusFilter(value: string | TaskStatusEnum | null): void {
    const status = TaskStatus.isStatus(value) ? value : null;
    if (status === this.activeStatusFilter) {
      return;
    }

    this.activeStatusFilter = status;
    this.applyFilters();
    void this.angularRouter.navigate([], {
      relativeTo: this.route,
      queryParams: {taskStatus: status, taskView: 'tasks'},
      queryParamsHandling: 'merge',
    });
  }

  public get activeStatusFilterLabel(): string | null {
    return this.activeStatusFilter
      ? (TaskStatus.STATUS_LABELS.get(this.activeStatusFilter) ?? this.activeStatusFilter)
      : null;
  }

  // The search term only narrows what the list shows, so typing must not close the
  // open task. Drop the selection when the task itself has gone or a view filter
  // hides it.
  private deselectHiddenTaskDefinition(): void {
    if (!this.selectedTaskDef) {
      return;
    }

    const selectedTaskDefinition = this.taskDefinitions?.find(
      (taskDef) => taskDef.id === this.selectedTaskDef.id,
    );

    if (selectedTaskDefinition && this.shouldShowTaskDefinition(selectedTaskDefinition)) {
      return;
    }

    // Following a link or notification into another unit swaps this list while the
    // old unit's task is still selected. The url already names the task to open in
    // the new unit, so leave it for applyRouteTaskSelection. Rewriting it to the bare
    // dashboard here is what used to land those links on the unit overview.
    const routeOpensAnotherListedTask =
      !!this.routeTaskAbbreviation &&
      !!this.taskDefinitions?.some(
        (taskDef) =>
          taskDef.abbreviation === this.routeTaskAbbreviation &&
          taskDef.id !== this.selectedTaskDef.id,
      );

    this.selectedTaskDefinition$?.next(null);
    if (!routeOpensAnotherListedTask) {
      this.replaceSelectionUrl(null);
    }
  }

  public setSortBy(sortBy: TaskListSortOption): void {
    const sortDirection =
      sortBy === 'default'
        ? DEFAULT_VIEW_PREFERENCES.sortDirection
        : this.viewPreferences.sortBy === sortBy
          ? this.toggledSortDirection
          : 'asc';

    this.viewPreferences = {
      ...this.viewPreferences,
      sortBy,
      sortDirection,
    };
    this.persistViewPreferences();
    this.applyFilters();
  }

  public toggleHideCompleted(value: boolean): void {
    this.viewPreferences = {
      ...this.viewPreferences,
      hideCompleted: value,
    };
    this.persistViewPreferences();
    this.applyFilters();
  }

  public toggleShowAboveTargetGrade(value: boolean): void {
    this.viewPreferences = {
      ...this.viewPreferences,
      showAboveTargetGrade: value,
    };
    this.persistViewPreferences();
    this.applyFilters();
  }

  public resetViewPreferences(): void {
    this.viewPreferences = {...DEFAULT_VIEW_PREFERENCES};
    this.persistViewPreferences();
    this.applyFilters();
  }

  public get selectedSortLabel(): string {
    const label =
      this.sortOptions.find((option) => option.value === this.viewPreferences.sortBy)?.label ??
      'Priority';

    if (this.viewPreferences.sortBy === 'default') {
      return label;
    }

    return `${label} ${this.viewPreferences.sortDirection}`;
  }

  public sortStateIconFor(option: TaskListSortOptionView): string {
    if (option.value === 'default') {
      return this.viewPreferences.sortBy === 'default' ? 'check' : '';
    }

    if (this.viewPreferences.sortBy !== option.value) {
      return '';
    }

    return this.viewPreferences.sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  public get activeViewPreferenceCount(): number {
    return (
      (this.viewPreferences.sortBy !== 'default' ? 1 : 0) +
      (this.viewPreferences.hideCompleted ? 1 : 0) +
      (this.hidingTasksAboveTargetGrade ? 1 : 0)
    );
  }

  // The list hides tasks beyond the target grade unless the student opts in, so the
  // badge has to count the hiding, not the opt-in that switches it off.
  public get hidingTasksAboveTargetGrade(): boolean {
    return !this.viewPreferences.showAboveTargetGrade && this.effectiveTargetGrade !== null;
  }

  public get hasNonDefaultViewPreferences(): boolean {
    return (
      this.viewPreferences.sortBy !== DEFAULT_VIEW_PREFERENCES.sortBy ||
      this.viewPreferences.sortDirection !== DEFAULT_VIEW_PREFERENCES.sortDirection ||
      this.viewPreferences.hideCompleted !== DEFAULT_VIEW_PREFERENCES.hideCompleted ||
      this.viewPreferences.showAboveTargetGrade !== DEFAULT_VIEW_PREFERENCES.showAboveTargetGrade
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('project' in changes || 'taskDefinitions' in changes) {
      this.loadViewPreferences();
    }

    if (
      'project' in changes ||
      'targetGrade' in changes ||
      'taskDefinitions' in changes ||
      'tasks' in changes
    ) {
      this.applyFilters();
      this.applyRouteTaskSelection();
    }
  }

  public get hasTasks(): boolean {
    return this.tasks && this.tasks.length > 0;
  }

  public taskForTaskDef(taskDef: TaskDefinition): Task {
    if (!this.hasTasks || !taskDef) {
      return null;
    }

    return this.tasks.find((task) => task.definition.id === taskDef?.id);
  }

  public taskListItem(taskDef: TaskDefinition): Task {
    return this.taskForTaskDef(taskDef);
  }

  public taskStatusLabel(task: Task): string {
    return TaskStatus.STATUS_LABELS.get(task?.status) ?? 'Status unavailable';
  }

  public taskStartApproaching(task: Task): boolean {
    return (
      !!task &&
      !task.inFinalState() &&
      task.isBeforeStartDate() &&
      task.daysUntilStartDate() <= START_APPROACHING_DAYS
    );
  }

  public taskStartLabel(task: Task): string {
    const days = task.daysUntilStartDate();

    if (days <= 0) {
      return 'Start today';
    }

    return `Start in ${days} ${days === 1 ? 'day' : 'days'}`;
  }

  // The badge only shows the count, so its accessible name carries the unit.
  public newCommentsLabel(task: Task): string {
    const count = task.numNewComments;

    return `${count} new ${count === 1 ? 'comment' : 'comments'}`;
  }

  public taskOngoing(task: Task): boolean {
    if (!task || task.inFinalState()) {
      return false;
    }

    const now = Date.now();
    const startTime = this.dateTime(task.startDate);
    const dueTime = this.dateTime(task.localDueDate());

    return now >= startTime && now < dueTime;
  }

  /*
    TODO: There's still an issue where loading the route for the first time will cause child components (like task-dashboard) to load trigger OnInit and OnChanges twice...
    Causing duplicate queries to submission_details and task comments.
    One hack would be to always keep the task-dashboard rendered using [hidden].
  */

  ngOnInit(): void {
    this.loadViewPreferences();
    this.applyFilters();

    // Watch for changes in the selected task definition... including from us
    this.selectedTaskDefinition$.pipe(takeUntil(this.destroy$)).subscribe((taskDef) => {
      this.selectedTaskDef = taskDef;
    });

    // Follow the selected task in the url, rather than reading it once.
    //
    // Angular reuses this component when only a route parameter changes, so
    // going from .../dashboard/1.1P to .../dashboard/2.3P never runs ngOnInit
    // again. Reading route.snapshot here left the first task selected and the
    // second one never opened, which is what any in-app link to another task on
    // a dashboard the user is already looking at runs into. A notification
    // linking to a task is exactly that.
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.routeTaskAbbreviation = params.get('taskAbbreviation');
      queueMicrotask(() => this.applyRouteTaskSelection());
    });

    this.route.queryParamMap?.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const status = params.get('taskStatus');
      const nextFilter = TaskStatus.isStatus(status) ? status : null;
      if (nextFilter !== this.activeStatusFilter) {
        this.activeStatusFilter = nextFilter;
        this.applyFilters();
      }
    });
  }

  // Applies whatever the route currently names, using the task definitions that
  // exist at the moment it runs. Called from the paramMap subscription and again
  // from ngOnChanges, because the unit resolves progressively and taskDefinitions
  // is usually still empty when the parameter first arrives. Without the second
  // call a hard refresh on a deep link lands on nothing.
  private applyRouteTaskSelection(): void {
    const current = this.selectedTaskDefinition$.value;

    const nextTaskDefinition = this.routeTaskAbbreviation
      ? (this.taskDefinitions?.find(
          (taskDefinition) => taskDefinition.abbreviation === this.routeTaskAbbreviation,
        ) ?? null)
      : null;

    // An empty list means the unit has not finished resolving, not that the task
    // is missing. Leave the selection alone and wait for ngOnChanges to call back
    // once the definitions arrive. A loaded list that does not contain the
    // abbreviation is a different thing and still clears the selection below.
    if (this.routeTaskAbbreviation && !this.taskDefinitions?.length) {
      return;
    }

    if (nextTaskDefinition && this.isTaskDefinitionAboveTargetGrade(nextTaskDefinition)) {
      this.viewPreferences = {...this.viewPreferences, showAboveTargetGrade: true};
      this.persistViewPreferences();
      this.applyFilters();
    }

    // The comparison is what stops a click looping. Selecting a task navigates,
    // that navigation makes paramMap emit, and the emission comes straight back
    // in here. It also collapses the duplicate write from the second rendered
    // instance of this component in the parent template.
    if (nextTaskDefinition !== current) {
      this.selectedTaskDefinition$.next(nextTaskDefinition);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setSelectedTaskDefinition(taskDef: TaskDefinition) {
    if (this.isSelectedTaskDefinition(taskDef)) {
      this.selectedTaskDefinition$.next(null);
      this.replaceSelectionUrl(null);
    } else {
      this.selectedTaskDefinition$.next(taskDef);
      this.replaceSelectionUrl(taskDef);
    }
  }

  public isSelectedTaskDefinition(taskDef: TaskDefinition): boolean {
    return this.selectedTaskDef?.id === taskDef?.id;
  }

  private replaceSelectionUrl(taskDef: TaskDefinition | null): void {
    const urlTree = this.buildSelectionUrlTree(taskDef);
    if (!urlTree) {
      return;
    }

    this.angularRouter.navigateByUrl(urlTree, {replaceUrl: true});
  }

  private buildSelectionUrlTree(taskDef: TaskDefinition | null) {
    if (this.selectionUrlBase) {
      return this.angularRouter.createUrlTree(
        taskDef ? [...this.selectionUrlBase, taskDef.abbreviation] : this.selectionUrlBase,
        {queryParamsHandling: 'preserve'},
      );
    }

    const unitId = this.route.parent?.snapshot.paramMap.get('unitId');
    if (this.route.parent?.snapshot.data.unit && unitId) {
      return this.angularRouter.createUrlTree(
        taskDef ? ['/units', unitId, 'tasks', taskDef.abbreviation] : ['/units', unitId, 'tasks'],
        {queryParamsHandling: 'preserve'},
      );
    }

    const projectId = this.route.parent?.snapshot.paramMap.get('projectId');
    if (this.route.parent?.snapshot.data.project && projectId) {
      return this.angularRouter.createUrlTree(
        taskDef
          ? ['/projects', projectId, 'dashboard', taskDef.abbreviation]
          : ['/projects', projectId, 'dashboard'],
        {queryParamsHandling: 'preserve'},
      );
    }

    return null;
  }

  private shouldShowTaskDefinition(taskDef: TaskDefinition): boolean {
    if (!taskDef) {
      return false;
    }

    const task = this.taskForTaskDef(taskDef);

    if (this.viewPreferences.hideCompleted && task?.inFinalState() && !this.hasNewComments(task)) {
      return false;
    }

    return !(
      !this.viewPreferences.showAboveTargetGrade &&
      this.isTaskDefinitionAboveTargetGrade(taskDef) &&
      !this.hasNewComments(task)
    );
  }

  private matchesStatusFilter(taskDef: TaskDefinition): boolean {
    if (!this.activeStatusFilter) {
      return true;
    }

    return this.taskForTaskDef(taskDef)?.status === this.activeStatusFilter;
  }

  private isTaskDefinitionAboveTargetGrade(taskDef: TaskDefinition): boolean {
    const targetGrade = this.effectiveTargetGrade;

    return targetGrade !== null && taskDef.targetGrade > targetGrade;
  }

  private get effectiveTargetGrade(): number | null {
    const targetGrade = this.targetGrade ?? this.project?.targetGrade;

    if (!this.project || targetGrade === undefined || targetGrade === null) {
      return null;
    }

    return targetGrade;
  }

  private hasNewComments(task: Task): boolean {
    return (task?.numNewComments ?? 0) > 0;
  }

  private compareTaskDefinitions(a: TaskDefinition, b: TaskDefinition): number {
    let result: number;

    switch (this.viewPreferences.sortBy) {
      case 'abbreviation':
        result = this.compareStrings(a?.abbreviation, b?.abbreviation);
        break;
      case 'targetDate':
        result = this.compareDates(this.targetDateFor(a), this.targetDateFor(b));
        break;
      case 'startDate':
        result = this.compareDates(this.startDateFor(a), this.startDateFor(b));
        break;
      case 'dueDate':
        result = this.compareDates(this.feedbackDateFor(a), this.feedbackDateFor(b));
        break;
      default:
        result = this.defaultSortWeightFor(a) - this.defaultSortWeightFor(b);
    }

    return this.viewPreferences.sortDirection === 'asc' ? result : result * -1;
  }

  private refreshTopTaskWeights(): void {
    if (this.project && this.hasTasks) {
      this.project.calcTopTasks();
    }
  }

  private defaultSortWeightFor(taskDef: TaskDefinition): number {
    return this.taskForTaskDef(taskDef)?.topWeight ?? taskDef?.seq ?? Number.MAX_SAFE_INTEGER;
  }

  private targetDateFor(taskDef: TaskDefinition): Date {
    return this.taskForTaskDef(taskDef)?.localDueDate() ?? taskDef?.targetDate;
  }

  private startDateFor(taskDef: TaskDefinition): Date {
    return this.taskForTaskDef(taskDef)?.startDate ?? taskDef?.startDate;
  }

  private feedbackDateFor(taskDef: TaskDefinition): Date {
    return this.taskForTaskDef(taskDef)?.localDeadlineDate() ?? taskDef?.localDeadlineDate();
  }

  private compareDates(a: Date, b: Date): number {
    const aTime = this.dateTime(a);
    const bTime = this.dateTime(b);

    if (aTime === bTime) {
      return 0;
    }

    return aTime - bTime;
  }

  private compareStrings(a: string, b: string): number {
    return (a ?? '').localeCompare(b ?? '', undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  private dateTime(date: Date): number {
    const time = date ? new Date(date).getTime() : NaN;
    return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
  }

  private loadViewPreferences(): void {
    const rawPreferences = this.viewPreferencesStorage?.getItem(this.viewPreferencesStorageKey);

    if (!rawPreferences) {
      this.viewPreferences = {...DEFAULT_VIEW_PREFERENCES};
      return;
    }

    try {
      const parsedPreferences = JSON.parse(rawPreferences) as Partial<TaskListViewPreferences>;
      const migratedSort = this.migrateSortOption(parsedPreferences.sortBy);
      this.viewPreferences = {
        sortBy: migratedSort.sortBy,
        sortDirection: this.isSortDirection(parsedPreferences.sortDirection)
          ? parsedPreferences.sortDirection
          : migratedSort.sortDirection,
        hideCompleted: !!parsedPreferences.hideCompleted,
        // The legacy preference was named `hideAboveTargetGrade` and defaulted to false,
        // which made higher-grade tasks visible. Treat legacy records as the new default.
        showAboveTargetGrade: parsedPreferences.showAboveTargetGrade === true,
      };
    } catch {
      this.viewPreferences = {...DEFAULT_VIEW_PREFERENCES};
    }
  }

  private persistViewPreferences(): void {
    this.viewPreferencesStorage?.setItem(
      this.viewPreferencesStorageKey,
      JSON.stringify(this.viewPreferences),
    );
  }

  private isSortOption(value: unknown): value is TaskListSortOption {
    return this.sortOptions.some((option) => option.value === value);
  }

  private isSortDirection(value: unknown): value is TaskListSortDirection {
    return value === 'asc' || value === 'desc';
  }

  private migrateSortOption(value: unknown): {
    sortBy: TaskListSortOption;
    sortDirection: TaskListSortDirection;
  } {
    if (this.isSortOption(value)) {
      return {sortBy: value, sortDirection: DEFAULT_VIEW_PREFERENCES.sortDirection};
    }

    const migrations: Record<
      string,
      {sortBy: TaskListSortOption; sortDirection: TaskListSortDirection}
    > = {
      abbreviationAsc: {sortBy: 'abbreviation', sortDirection: 'asc'},
      abbreviationDesc: {sortBy: 'abbreviation', sortDirection: 'desc'},
      targetDateAsc: {sortBy: 'targetDate', sortDirection: 'asc'},
      targetDateDesc: {sortBy: 'targetDate', sortDirection: 'desc'},
      startDateAsc: {sortBy: 'startDate', sortDirection: 'asc'},
      startDateDesc: {sortBy: 'startDate', sortDirection: 'desc'},
      feedbackDateAsc: {sortBy: 'dueDate', sortDirection: 'asc'},
      feedbackDateDesc: {sortBy: 'dueDate', sortDirection: 'desc'},
    };

    return migrations[value as string] ?? DEFAULT_VIEW_PREFERENCES;
  }

  private get toggledSortDirection(): TaskListSortDirection {
    return this.viewPreferences.sortDirection === 'asc' ? 'desc' : 'asc';
  }

  private get viewPreferencesStorageKey(): string {
    const unitId = this.project?.unit?.id ?? this.taskDefinitions?.[0]?.unit?.id ?? 'unknown';
    const userId = this.userService.currentUser?.id ?? 'unknown';
    return `ontrack.user.${userId}.unitTaskList.${unitId}.viewPreferences`;
  }

  private get viewPreferencesStorage(): Storage | null {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }
}
