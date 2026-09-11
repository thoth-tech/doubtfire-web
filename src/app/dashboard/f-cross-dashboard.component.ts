import {EntityCache} from 'ngx-entity-service';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {catchError, debounceTime, filter, map, merge, of, switchMap, tap} from 'rxjs';
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

enum Filter {
  HideCompleted = 'Hide Completed',
}

enum SortMode {
  Recommended = 'Recommended',
  SubmissionDate = 'Due Date',
  Default = 'Default',
}

const completedTypes: readonly TaskStatusEnum[] = ['complete'];
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

type DashboardUnit = {
  projectId: number;
  code: string;
  name: string;
  tasks: DashboardTask[];
  gradeSummaries: GradeCompletionSummary[];
  mobileSummary: MobileUnitSummary;
  isPrevious: boolean;
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

  constructor(
    private globalStateService: GlobalStateService,
    private projectService: ProjectService,
    private taskRecommendationService: TaskRecommendationService,
    private taskService: TaskService,
    private changeDetectorRef: ChangeDetectorRef,
    private destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this.globalStateService.onLoad(() => {
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

      merge(projectChanges, activeTaskStatusChanges)
        .pipe(
          switchMap(() => this.taskRecommendationService.getAll().pipe(catchError(() => of([])))),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((recommendations) => {
          this.setRecommendationScores(recommendations);
          this.processTasks();
        });
    });
  }

  private refreshActiveUnits(projects: readonly Project[]): void {
    const activeProjects = projects.filter((project) => project.unit.isActive);
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
      this.selectedGrades.length > 0
    );
  }

  get hasGlobalToolbarChanges(): boolean {
    return (
      this.unitScope !== 'active' ||
      this.globalSearchTerm.length > 0 ||
      this.selectedStatuses.length > 0 ||
      this.selectedGrades.length > 0 ||
      !!this.startDate ||
      !!this.endDate
    );
  }

  get mobileSecondaryFilterCount(): number {
    return (
      this.selectedStatuses.length +
      this.selectedGrades.length +
      Number(!!this.startDate) +
      Number(!!this.endDate)
    );
  }

  setUnitScope(scope: UnitScope): void {
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
    this.startDate = '';
    this.endDate = '';

    if (this.unitScope !== 'active') {
      this.setUnitScope('active');
      return;
    }

    this.processTasks();
  }

  setStartDate(value: string): void {
    this.startDate = value;
    this.processTasks();
  }

  setEndDate(value: string): void {
    this.endDate = value;
    this.processTasks();
  }

  clearDateRange(): void {
    this.startDate = '';
    this.endDate = '';
    this.processTasks();
  }

  setSort(project: number, mode: SortMode): void {
    this.sorting.set(project, mode);
    this.processTasks();
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
      this.isDateFilterActive ||
      this.hasSearchTerm(project) ||
      (this.filters.get(project)?.length ?? 0) > 0
    );
  }

  private loadPreviousUnits(): void {
    this.loadingPreviousUnits = true;
    this.previousUnitsLoadError = false;

    this.projectService
      .query(undefined, {
        cache: this.previousProjectsCache,
        params: {
          include_inactive: true,
          include_task_definitions: true,
        },
      })
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
            const sort = this.sorting.get(unit.projectId) ?? SortMode.Recommended;

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

    return matchesStatus && matchesGrade && this.taskMatchesGlobalSearch(task, unit);
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
      [...searchableValues, this.formatDateForSearch(task.dueDate)].join(' '),
    );

    return remainingSearchTerm.split(' ').every((term) => searchableText.includes(term));
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
    return projects.map((project) => {
      project.calcTopTasks();
      const unit = project.unit;

      return {
        projectId: project.id,
        code: unit.code,
        name: unit.name,
        // The cross-unit dashboard is an authorised-task view, not a target-grade plan.
        // `activeTasks()` excludes definitions above the student's current target grade,
        // even though those tasks are returned by the API and remain available to them.
        tasks: this.mapTasks(project.tasks, project.id, unit.code),
        gradeSummaries: [],
        mobileSummary: {
          taskCountLabel: '0 tasks',
          deadlineLabel: 'No upcoming deadlines',
          hasDeadlineWarning: false,
        },
        isPrevious: !unit.isActive,
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
        color: TaskStatus.STATUS_COLORS.get(task.status),
        comments: task.numNewComments ?? 0,
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
