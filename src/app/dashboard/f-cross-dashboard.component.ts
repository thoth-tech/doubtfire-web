import {EntityCache} from 'ngx-entity-service';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormControl, FormGroup} from '@angular/forms';
import {MatEndDate, MatStartDate} from '@angular/material/datepicker';
import {ActivatedRoute, Router} from '@angular/router';
import {Subject, catchError, debounceTime, filter, map, merge, of, switchMap, tap} from 'rxjs';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {Grade} from '../api/models/grade';
import {Project} from '../api/models/project';
import {Task} from '../api/models/task';
import {TaskStatus, TaskStatusEnum} from '../api/models/task-status';
import {ProjectService} from '../api/services/project.service';
import {
  TaskRecommendation,
  TaskRecommendationService,
} from '../api/services/task-recommendation.service';
import {TaskService} from '../api/services/task.service';
import {DashboardTask, getDueDateWarning} from './list-item/dashboard-list-item.component';

type UnitScope = 'active' | 'previous' | 'all';
type FeedbackFilter = 'all' | 'available' | 'none' | 'unavailable';

enum Filter {
  HideCompleted = 'Hide Completed',
}

enum SortMode {
  Recommended = 'Recommended',
  SubmissionDate = 'Due Date',
  Default = 'Default',
}

const completedTypes: readonly TaskStatusEnum[] = ['complete'];
const UNIT_ACCENT_COUNT = 6;
const finalTypes: readonly TaskStatusEnum[] = TaskStatus.FINAL_STATUSES;

const displayedDueDateFormatter = new Intl.DateTimeFormat('en-AU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const mobileDueDateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
});

type MobileUnitSummary = {
  taskCountLabel: string;
  deadlineLabel: string;
  hasDeadlineWarning: boolean;
};

type UnitProgressSegment = {
  status: TaskStatusEnum;
  label: string;
  color: string;
  count: number;
};

type UnitProgress = {
  completed: number;
  total: number;
  percentage: number;
  segments: UnitProgressSegment[];
  ariaLabel: string;
};

type DashboardSummary = {
  unitLabel: string;
  overdue: number;
  dueSoon: number;
};

type DashboardUnit = {
  projectId: number;
  code: string;
  name: string;
  tasks: DashboardTask[];
  gradeSummaries: GradeCompletionSummary[];
  mobileSummary: MobileUnitSummary;
  progress: UnitProgress;
  accent: string;
  isPrevious: boolean;
  progressLabel: string;
};

type GradeCompletionSummary = {
  targetGrade: number;
  label: string;
  completed: number;
  total: number;
  percentage: number | null;
};

@Component({
  selector: 'f-cross-dashboard',
  templateUrl: './f-cross-dashboard.component.html',
  styleUrl: './f-cross-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CrossDashboardComponent implements OnInit {
  activeUnits: DashboardUnit[] = [];
  previousUnits: DashboardUnit[] = [];

  unitScope: UnitScope = 'active';

  globalSearchTerm = '';
  selectedStatuses: TaskStatusEnum[] = [];
  selectedGrades: number[] = [];
  feedbackFilter: FeedbackFilter = 'all';
  density: 'comfortable' | 'compact' = 'comfortable';
  loadingActiveUnits = true;
  activeUnitsLoadError = false;
  loadingRecommendations = false;
  recommendationsLoadError = false;

  readonly statusOptions = TaskStatus.STATUS_KEYS.flatMap((value) => {
    const label = TaskStatus.STATUS_LABELS.get(value);
    return label ? [{value, label}] : [];
  });
  readonly gradeOptions = Grade.PASS_RANGE.map((value) => ({
    value,
    label: Grade.GRADES[value],
  }));

  startDate = '';
  endDate = '';
  // The range picker works in Dates while the filter keeps ISO day strings. The
  // form group owns what the field shows, so a reset also clears text that never
  // parsed, and its validators flag typos and reversed ranges on the inputs.
  readonly dateRange = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });
  @ViewChild(MatStartDate) private startDateInput?: MatStartDate<Date>;
  @ViewChild(MatEndDate) private endDateInput?: MatEndDate<Date>;
  // Material re-runs its sibling validators during a reset and each run emits
  // valueChanges, so the reset mutes the subscription and processes once itself.
  private resettingDates = false;

  previousUnitsLoaded = false;
  loadingPreviousUnits = false;
  previousUnitsLoadError = false;

  filterOptions = Object.values(Filter);
  sortOptions = Object.values(SortMode);
  unitsProcessed: DashboardUnit[] = [];
  expandedMobileProjectId: number | null = null;
  mobileGlobalFiltersExpanded = false;

  private readonly previousProjectsCache: EntityCache<Project> = new EntityCache();
  private filters: Map<number, Filter[]> = new Map();
  private sorting: Map<number, SortMode> = new Map();
  private searchTerms: Map<number, string> = new Map();
  private recommendationScores: Map<string, number> = new Map();
  private readonly recommendationRefresh: Subject<void> = new Subject();
  private refreshedActiveProjectIds: Set<number> | null = null;

  constructor(
    private globalStateService: GlobalStateService,
    private projectService: ProjectService,
    private taskRecommendationService: TaskRecommendationService,
    private taskService: TaskService,
    private changeDetectorRef: ChangeDetectorRef,
    private destroyRef: DestroyRef,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.dateRange.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({start, end}) => {
        if (this.resettingDates) {
          return;
        }
        this.startDate = this.formatDateAsIso(start);
        this.endDate = this.formatDateAsIso(end);
        this.processTasks();
      });

    this.globalStateService.onLoad(() => {
      this.loadingActiveUnits = false;
      this.activeUnitsLoadError = this.globalStateService.projectLoadErrorSubject.value;
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const requested = params.get('scope');
        const scope: UnitScope =
          requested === 'previous' || requested === 'all' ? requested : 'active';
        if (scope !== this.unitScope) {
          this.applyUnitScope(scope);
        }
      });

      const projectChanges = this.globalStateService.currentUserProjects.values.pipe(
        tap((projects) => this.refreshActiveUnits(projects)),
        map(() => undefined),
      );
      const activeTaskStatusChanges = this.taskService.taskStatusUpdated$.pipe(
        filter((task) => this.isTaskInActiveProject(task)),
        debounceTime(0),
        tap(() =>
          this.refreshActiveUnits(this.globalStateService.currentUserProjects.currentValues),
        ),
        map(() => undefined),
      );

      merge(projectChanges, activeTaskStatusChanges, this.recommendationRefresh)
        .pipe(
          tap(() => {
            this.loadingRecommendations = true;
            this.recommendationsLoadError = false;
          }),
          switchMap(() =>
            this.taskRecommendationService.getAll().pipe(
              catchError(() => {
                this.recommendationsLoadError = true;
                return of(null);
              }),
            ),
          ),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((recommendations) => {
          this.loadingRecommendations = false;
          if (recommendations !== null) {
            this.setRecommendationScores(recommendations);
          }
          this.processTasks();
        });
    });
  }

  private refreshActiveUnits(projects: readonly Project[]): void {
    const activeProjects = projects.filter(
      (project) =>
        project.unit.isActive &&
        (this.refreshedActiveProjectIds === null || this.refreshedActiveProjectIds.has(project.id)),
    );
    this.activeUnits = this.mapProjects(activeProjects);
    this.processTasks();
  }

  private isTaskInActiveProject(task: Task): boolean {
    const projectId = task.project?.id;

    return this.globalStateService.currentUserProjects.currentValues.some(
      (project) => project.id === projectId && project.unit.isActive,
    );
  }

  get displayedUnits(): DashboardUnit[] {
    return this.unitsProcessed;
  }

  get resultCountLabel(): string {
    const count = this.displayedUnits.reduce((total, unit) => total + unit.tasks.length, 0);
    return `${count} ${count === 1 ? 'task' : 'tasks'} in ${this.displayedUnits.length} ${
      this.displayedUnits.length === 1 ? 'unit' : 'units'
    }`;
  }

  setFeedbackFilter(value: FeedbackFilter): void {
    this.feedbackFilter = value;
    this.processTasks();
  }

  retryRecommendations(): void {
    if (!this.loadingRecommendations) {
      this.recommendationRefresh.next();
    }
  }

  retryActiveUnits(): void {
    if (this.loadingActiveUnits) {
      return;
    }
    this.loadingActiveUnits = true;
    this.activeUnitsLoadError = false;
    this.projectService
      .fetchAll(undefined, {
        cache: this.globalStateService.currentUserProjects,
        params: {include_inactive: false, include_task_definitions: true},
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (projects: Project[]) => {
          this.loadingActiveUnits = false;
          this.refreshedActiveProjectIds = new Set(projects.map((project) => project.id));
          this.globalStateService.projectLoadErrorSubject.next(false);
          this.refreshActiveUnits(projects);
        },
        error: () => {
          this.loadingActiveUnits = false;
          this.activeUnitsLoadError = true;
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  get isDateRangeInvalid(): boolean {
    return !!this.startDate && !!this.endDate && this.startDate > this.endDate;
  }

  get isDateFilterActive(): boolean {
    return !this.isDateRangeInvalid && (!!this.startDate || !!this.endDate);
  }

  get hasGlobalTaskCriteria(): boolean {
    return (
      this.normaliseSearchText(this.globalSearchTerm).length > 0 ||
      this.selectedStatuses.length > 0 ||
      this.selectedGrades.length > 0 ||
      this.feedbackFilter !== 'all'
    );
  }

  get hasGlobalToolbarChanges(): boolean {
    return (
      this.unitScope !== 'active' ||
      this.globalSearchTerm.length > 0 ||
      this.selectedStatuses.length > 0 ||
      this.selectedGrades.length > 0 ||
      this.feedbackFilter !== 'all' ||
      this.hasDateText
    );
  }

  // True while either date field holds anything, including text that did not parse,
  // so Clear all and the clear button stay available to wipe a typo.
  get hasDateText(): boolean {
    return !!this.startDate || !!this.endDate || this.hasDateParseError;
  }

  get dateRangeError(): string | null {
    if (this.hasDateParseError) {
      return 'Enter dates as dd/mm/yyyy.';
    }

    return this.isDateRangeInvalid ? 'Start date must be on or before end date.' : null;
  }

  private get hasDateParseError(): boolean {
    const {start, end} = this.dateRange.controls;

    return start.hasError('matDatepickerParse') || end.hasError('matDatepickerParse');
  }

  get mobileSecondaryFilterCount(): number {
    return (
      this.selectedStatuses.length +
      this.selectedGrades.length +
      Number(this.feedbackFilter !== 'all') +
      Number(!!this.startDate) +
      Number(!!this.endDate)
    );
  }

  setUnitScope(scope: UnitScope): void {
    this.applyUnitScope(scope);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {scope: scope === 'active' ? null : scope},
      queryParamsHandling: 'merge',
      preserveFragment: true,
      replaceUrl: true,
    });
  }

  private applyUnitScope(scope: UnitScope): void {
    this.unitScope = scope;
    this.expandedMobileProjectId = null;
    this.processTasks();

    const needsPreviousUnits = scope === 'previous' || scope === 'all';

    if (needsPreviousUnits && !this.previousUnitsLoaded && !this.loadingPreviousUnits) {
      this.loadPreviousUnits();
    }
  }

  setGlobalSearch(value: string): void {
    this.globalSearchTerm = value ?? '';
    this.processTasks();
  }

  toggleMobileProject(projectId: number): void {
    this.expandedMobileProjectId = this.expandedMobileProjectId === projectId ? null : projectId;
  }

  toggleMobileGlobalFilters(): void {
    this.mobileGlobalFiltersExpanded = !this.mobileGlobalFiltersExpanded;
  }

  isMobileProjectExpanded(projectId: number): boolean {
    return this.expandedMobileProjectId === projectId;
  }

  setStatuses(statuses: readonly TaskStatusEnum[] | null): void {
    this.selectedStatuses = [...(statuses ?? [])];
    this.processTasks();
  }

  setGrades(grades: readonly number[] | null): void {
    this.selectedGrades = [...(grades ?? [])];
    this.processTasks();
  }

  clearGlobalFilters(): void {
    this.globalSearchTerm = '';
    this.selectedStatuses = [];
    this.selectedGrades = [];
    this.feedbackFilter = 'all';
    this.resetDateRange();

    if (this.unitScope !== 'active') {
      this.setUnitScope('active');
      return;
    }

    this.processTasks();
  }

  setStartDate(value: string): void {
    this.startDate = value;
    this.dateRange.controls.start.setValue(this.parseIsoDate(value), {emitEvent: false});
    this.processTasks();
  }

  setEndDate(value: string): void {
    this.endDate = value;
    this.dateRange.controls.end.setValue(this.parseIsoDate(value), {emitEvent: false});
    this.processTasks();
  }

  clearDateRange(): void {
    this.resetDateRange();
    this.processTasks();
  }

  setSort(project: number, mode: SortMode): void {
    this.sorting.set(project, mode);
    this.processTasks();
  }

  getSort(project: number): SortMode {
    return this.sorting.get(project) ?? SortMode.Recommended;
  }

  toggleFilter(project: number, filter: Filter): void {
    let filters = this.filters.get(project) ?? [];
    if (filters.includes(filter)) {
      filters = filters.filter((currentFilter) => currentFilter !== filter);
    } else {
      filters = [...filters, filter];
    }
    this.filters.set(project, filters);
    this.processTasks();
  }

  isFilterEnabled(project: number, filter: Filter): boolean {
    return this.filters.get(project)?.includes(filter) === true;
  }

  activeFilterCount(project: number): number {
    return this.filters.get(project)?.length ?? 0;
  }

  retryPreviousUnits(): void {
    if (!this.loadingPreviousUnits) {
      this.loadPreviousUnits();
    }
  }

  setSearch(project: number, value: string): void {
    this.searchTerms.set(project, value ?? '');
    this.processTasks();
  }

  getSearchTerm(project: number): string {
    return this.searchTerms.get(project) ?? '';
  }

  hasSearchTerm(project: number): boolean {
    return this.normaliseSearchText(this.getSearchTerm(project)).length > 0;
  }

  hasActiveTaskCriteria(project: number): boolean {
    return (
      this.hasGlobalTaskCriteria ||
      this.isDateFilterActive ||
      this.hasSearchTerm(project) ||
      (this.filters.get(project)?.length ?? 0) > 0
    );
  }

  loadPreviousUnits(): void {
    if (this.loadingPreviousUnits) {
      return;
    }
    this.loadingPreviousUnits = true;
    this.previousUnitsLoadError = false;

    this.projectService
      .fetchAll(undefined, {
        cache: this.previousProjectsCache,
        params: {
          include_inactive: true,
          include_task_definitions: true,
        },
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (projects: Project[]) => {
          const previousProjects = projects.filter((project) => !project.unit.isActive);

          this.previousUnits = this.mapProjects(previousProjects);
          this.previousUnitsLoaded = true;
          this.loadingPreviousUnits = false;
          this.processTasks();

          this.changeDetectorRef.detectChanges();
        },
        error: () => {
          this.previousUnitsLoadError = true;
          this.loadingPreviousUnits = false;
          this.processTasks();

          this.changeDetectorRef.detectChanges();
        },
      });
  }

  private processTasks(): void {
    const units = this.getUnitsForCurrentScope();

    this.unitsProcessed = units
      .map((unit) => ({
        unit,
        globallyFilteredTasks: unit.tasks.filter((task) =>
          this.taskMatchesGlobalCriteria(task, unit),
        ),
      }))
      .filter(
        ({globallyFilteredTasks}) =>
          !this.hasGlobalTaskCriteria || globallyFilteredTasks.length > 0,
      )
      .map(({unit, globallyFilteredTasks}) => ({
        ...unit,
        gradeSummaries: this.buildGradeSummaries(unit.tasks),
        tasks: globallyFilteredTasks
          .filter((task) => {
            const filters = this.filters.get(unit.projectId) ?? [];
            const isHiddenCompletedTask =
              filters.includes(Filter.HideCompleted) && completedTypes.includes(task.status);

            return (
              !isHiddenCompletedTask &&
              this.taskMatchesDateRange(task) &&
              this.taskMatchesPerUnitSearch(task, unit)
            );
          })
          .sort((a, b) => {
            const sort = this.getSort(unit.projectId);

            if (finalTypes.includes(a.status) && !finalTypes.includes(b.status)) {
              return 1;
            }

            if (!finalTypes.includes(a.status) && finalTypes.includes(b.status)) {
              return -1;
            }

            switch (sort) {
              case SortMode.Recommended:
                return this.compareRecommendations(a, b);
              case SortMode.SubmissionDate:
                return this.compareDueDates(a.dueDate, b.dueDate);
              case SortMode.Default:
                return a.weight - b.weight;
            }

            return 0;
          }),
      }));

    this.unitsProcessed = this.unitsProcessed.map((unit) => ({
      ...unit,
      mobileSummary: this.buildMobileUnitSummary(unit.tasks),
    }));

    this.changeDetectorRef.markForCheck();
  }

  // The page heading counts deadlines across the whole scope, not the filtered
  // columns, so searching for one task does not make the overdue count vanish.
  // It is a getter, like each row's deadline chip, so both read the same clock
  // and a deadline that passes while the page is open moves them together.
  get summary(): DashboardSummary {
    const units = this.getUnitsForCurrentScope();
    const scopeLabel = {active: 'active ', previous: 'previous ', all: ''}[this.unitScope];
    const warnings = units
      .filter((unit) => !unit.isPrevious)
      .flatMap((unit) => unit.tasks)
      .filter((task) => !finalTypes.includes(task.status))
      .map((task) => getDueDateWarning(task.dueDate, task.showDueWarning)?.state)
      .filter((state) => state !== undefined);

    return {
      unitLabel: `${units.length} ${scopeLabel}${units.length === 1 ? 'unit' : 'units'}`,
      overdue: warnings.filter((state) => state === 'overdue').length,
      dueSoon: warnings.filter((state) => state !== 'overdue').length,
    };
  }

  private buildProgress(tasks: readonly DashboardTask[]): UnitProgress {
    const counts: Map<TaskStatusEnum, number> = new Map();
    tasks.forEach((task) => counts.set(task.status, (counts.get(task.status) ?? 0) + 1));

    const segments = TaskStatus.PEER_PROGRESS_DISPLAY_ORDER.filter((status) =>
      counts.has(status),
    ).map((status) => ({
      status,
      label: TaskStatus.STATUS_LABELS.get(status) ?? status,
      // The bar is drawn on the card surface, so it takes the -graphic colour,
      // which keeps 3:1 against the surface in both themes.
      color: `var(--ot-status-${TaskStatus.statusClass(status)}-graphic)`,
      count: counts.get(status) ?? 0,
    }));
    const completed = counts.get('complete') ?? 0;
    const total = tasks.length;

    return {
      completed,
      total,
      percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
      segments,
      ariaLabel:
        total === 0
          ? 'No tasks yet'
          : `Task statuses: ${segments.map((segment) => `${segment.count} ${segment.label}`).join(', ')}`,
    };
  }

  private setRecommendationScores(recommendations: readonly TaskRecommendation[]): void {
    this.recommendationScores = new Map(
      recommendations
        .filter((recommendation) => Number.isFinite(recommendation.priority_score))
        .map((recommendation) => [
          this.recommendationKey(recommendation.project_id, recommendation.task_definition_id),
          recommendation.priority_score,
        ]),
    );
  }

  private compareRecommendations(first: DashboardTask, second: DashboardTask): number {
    const firstScore = this.recommendationScores.get(
      this.recommendationKey(first.projectId, first.taskDefinitionId),
    );
    const secondScore = this.recommendationScores.get(
      this.recommendationKey(second.projectId, second.taskDefinitionId),
    );

    if (firstScore !== undefined && secondScore !== undefined) {
      return secondScore - firstScore || first.weight - second.weight;
    }

    if (firstScore !== undefined) {
      return -1;
    }

    if (secondScore !== undefined) {
      return 1;
    }

    return first.weight - second.weight;
  }

  private recommendationKey(projectId: number, taskDefinitionId: number): string {
    return `${projectId}:${taskDefinitionId}`;
  }

  private taskMatchesGlobalCriteria(task: DashboardTask, unit: DashboardUnit): boolean {
    const matchesStatus =
      this.selectedStatuses.length === 0 || this.selectedStatuses.includes(task.status);
    const matchesGrade =
      this.selectedGrades.length === 0 || this.selectedGrades.includes(task.targetGrade);

    const matchesFeedback =
      this.feedbackFilter === 'all' ||
      (this.feedbackFilter === 'available' && task.hasFeedback === true) ||
      (this.feedbackFilter === 'none' && task.hasFeedback === false) ||
      (this.feedbackFilter === 'unavailable' && task.hasFeedback == null);

    return (
      matchesStatus && matchesGrade && matchesFeedback && this.taskMatchesGlobalSearch(task, unit)
    );
  }

  private buildGradeSummaries(tasks: readonly DashboardTask[]): GradeCompletionSummary[] {
    return this.selectedGrades.map((targetGrade) => {
      const tasksInGrade = tasks.filter((task) => task.targetGrade === targetGrade);
      const completed = tasksInGrade.filter((task) => task.status === 'complete').length;
      const total = tasksInGrade.length;

      return {
        targetGrade,
        label:
          tasksInGrade[0]?.targetGradeLabel ??
          this.gradeOptions.find((option) => option.value === targetGrade)?.label ??
          '',
        completed,
        total,
        percentage: total === 0 ? null : Math.round((completed / total) * 100),
      };
    });
  }

  private buildMobileUnitSummary(tasks: readonly DashboardTask[]): MobileUnitSummary {
    const taskCount = tasks.length;
    const nextDueTask = tasks
      .filter(
        (task) =>
          task.showDueWarning &&
          !finalTypes.includes(task.status) &&
          task.dueDate instanceof Date &&
          !Number.isNaN(task.dueDate.getTime()),
      )
      .sort((first, second) => this.compareDueDates(first.dueDate, second.dueDate))[0];

    if (!nextDueTask || !(nextDueTask.dueDate instanceof Date)) {
      return {
        taskCountLabel: `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`,
        deadlineLabel: 'No upcoming deadlines',
        hasDeadlineWarning: false,
      };
    }

    const warning = getDueDateWarning(nextDueTask.dueDate, true);

    return {
      taskCountLabel: `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`,
      deadlineLabel: warning
        ? `${warning.label}: ${nextDueTask.abbreviation}`
        : `Next due ${mobileDueDateFormatter.format(nextDueTask.dueDate)}: ${
            nextDueTask.abbreviation
          }`,
      hasDeadlineWarning: warning !== null,
    };
  }

  private taskMatchesDateRange(task: DashboardTask): boolean {
    if (!this.isDateFilterActive) {
      return true;
    }

    const taskDate = this.formatDateAsIso(task.dueDate);

    if (!taskDate) {
      return false;
    }

    if (this.startDate && taskDate < this.startDate) {
      return false;
    }

    if (this.endDate && taskDate > this.endDate) {
      return false;
    }

    return true;
  }

  private compareDueDates(
    firstDate: Date | null | undefined,
    secondDate: Date | null | undefined,
  ): number {
    const firstTime =
      firstDate instanceof Date && !Number.isNaN(firstDate.getTime()) ? firstDate.getTime() : null;

    const secondTime =
      secondDate instanceof Date && !Number.isNaN(secondDate.getTime())
        ? secondDate.getTime()
        : null;

    if (firstTime === null && secondTime === null) {
      return 0;
    }

    if (firstTime === null) {
      return 1;
    }

    if (secondTime === null) {
      return -1;
    }

    return firstTime - secondTime;
  }

  private taskMatchesGlobalSearch(task: DashboardTask, unit: DashboardUnit): boolean {
    return this.taskMatchesSearchText(task, this.globalSearchTerm, [
      unit.code,
      unit.name,
      task.title,
      task.abbreviation,
      task.statusLabel,
      task.targetGradeLabel,
    ]);
  }

  private taskMatchesPerUnitSearch(task: DashboardTask, unit: DashboardUnit): boolean {
    return this.taskMatchesSearchText(task, this.getSearchTerm(unit.projectId), [
      task.title,
      task.subtitle,
      task.description,
      task.abbreviation,
      task.statusLabel,
      unit.code,
    ]);
  }

  private taskMatchesSearchText(
    task: DashboardTask,
    rawSearchTerm: string,
    searchableValues: readonly string[],
  ): boolean {
    const searchTerm = this.normaliseSearchText(rawSearchTerm);

    if (!searchTerm) {
      return true;
    }

    const {numericDates, remainingText} = this.extractNumericDateSearches(rawSearchTerm);
    const taskDate = this.formatDateAsIso(task.dueDate);

    if (numericDates.some((date) => date !== taskDate)) {
      return false;
    }

    const remainingSearchTerm = this.normaliseSearchText(remainingText);

    if (!remainingSearchTerm) {
      return numericDates.length > 0;
    }

    const searchableText = this.normaliseSearchText(
      [
        ...searchableValues,
        this.feedbackSearchText(task),
        this.formatDateForSearch(task.dueDate),
      ].join(' '),
    );

    return remainingSearchTerm.split(' ').every((term) => searchableText.includes(term));
  }

  private feedbackSearchText(task: DashboardTask): string {
    const feedback =
      task.hasFeedback === true
        ? 'staff feedback available'
        : task.hasFeedback === false
          ? 'no staff feedback'
          : 'feedback unavailable';
    return task.comments > 0 ? `${feedback} unread comments` : feedback;
  }

  private extractNumericDateSearches(value: string): {
    numericDates: string[];
    remainingText: string;
  } {
    const numericDates: string[] = [];
    let remainingText = value;

    remainingText = remainingText.replace(
      /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
      (_match: string, year: string, month: string, day: string) => {
        numericDates.push(this.normaliseNumericDate(year, month, day));
        return ' ';
      },
    );

    remainingText = remainingText.replace(
      /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
      (_match: string, day: string, month: string, year: string) => {
        numericDates.push(this.normaliseNumericDate(year, month, day));
        return ' ';
      },
    );

    return {numericDates, remainingText};
  }

  private resetDateRange(): void {
    this.startDate = '';
    this.endDate = '';
    this.resettingDates = true;
    try {
      this.dateRange.reset({start: null, end: null}, {emitEvent: false});
      // A reset writes null, and Material only reformats the field when the value
      // changes, so text that never parsed (already null) would stay on screen. The
      // inputs' own value setter always reformats, so clear through it too.
      if (this.startDateInput) {
        this.startDateInput.value = null;
      }
      if (this.endDateInput) {
        this.endDateInput.value = null;
      }
      this.revalidateDateRange();
    } finally {
      this.resettingDates = false;
    }
  }

  // Each end's range check depends on the other end, and Material only re-runs the
  // one being typed in. Correcting the start would leave a stale "end before start"
  // error on the end, so every edit re-checks both.
  revalidateDateRange(): void {
    this.dateRange.controls.start.updateValueAndValidity({emitEvent: false});
    this.dateRange.controls.end.updateValueAndValidity({emitEvent: false});
  }

  private parseIsoDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');

    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  }

  private normaliseNumericDate(year: string, month: string, day: string): string {
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  private normaliseSearchText(value: string): string {
    return value
      .toLocaleLowerCase('en-AU')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  private formatDateAsIso(date: Date | null | undefined): string {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return '';
    }

    return this.normaliseNumericDate(
      String(date.getFullYear()),
      String(date.getMonth() + 1),
      String(date.getDate()),
    );
  }

  private formatDateForSearch(date: Date | null | undefined): string {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return '';
    }

    const isoDate = this.formatDateAsIso(date);
    const [year, month, day] = isoDate.split('-');

    return [displayedDueDateFormatter.format(date), `${day}/${month}/${year}`, isoDate].join(' ');
  }

  private getUnitsForCurrentScope(): DashboardUnit[] {
    if (this.unitScope === 'previous') {
      return this.previousUnits;
    }

    if (this.unitScope === 'all') {
      return [...this.activeUnits, ...this.previousUnits];
    }

    return this.activeUnits;
  }

  private mapProjects(projects: readonly Project[]): DashboardUnit[] {
    return projects.map((project, index) => {
      project.calcTopTasks();
      const unit = project.unit;
      // The cross-unit dashboard is an authorised-task view, not a target-grade plan.
      // `activeTasks()` excludes definitions above the student's current target grade,
      // even though those tasks are returned by the API and remain available to them.
      const tasks = this.mapTasks(project.tasks, project.id, unit.code);

      return {
        projectId: project.id,
        code: unit.code,
        name: unit.name,
        tasks,
        gradeSummaries: [],
        progress: this.buildProgress(tasks),
        // Active units take the six unit accents in order, so neighbouring columns
        // never share a colour. Finished units share the quieter slate band.
        accent: unit.isActive
          ? `var(--ot-unit-${(index % UNIT_ACCENT_COUNT) + 1})`
          : 'var(--ot-unit-previous)',
        mobileSummary: {
          taskCountLabel: '0 tasks',
          deadlineLabel: 'No upcoming deadlines',
          hasDeadlineWarning: false,
        },
        isPrevious: !unit.isActive,
        progressLabel: `${project.tasks.filter((task) => task.status === 'complete').length} of ${project.tasks.length} tasks complete`,
      };
    });
  }

  private mapTasks(tasks: readonly Task[], projectId: number, unitCode: string): DashboardTask[] {
    return tasks.map((task) => {
      const def = task.definition;

      return {
        taskDefinitionId: def.id,
        title: def.name,
        subtitle: `${def.abbreviation} - ${def.targetGradeText} Task`,
        statusLabel: TaskStatus.STATUS_LABELS.get(task.status),
        abbreviation: def.abbreviation,
        comments: task.numNewComments ?? 0,
        hasFeedback: typeof task.hasFeedback === 'boolean' ? task.hasFeedback : null,
        status: task.status,
        targetGrade: def.targetGrade,
        targetGradeLabel: def.targetGradeText,
        weight: task.topWeight,
        projectId,
        description: def.description,
        taskDef: def,
        unitCode,
        dueDate: task.localDueDate(),
        showDueWarning: !task.inSubmittedState(),
      };
    });
  }
}
