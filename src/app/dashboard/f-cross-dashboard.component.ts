import {EntityCache} from 'ngx-entity-service';
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {Project} from '../api/models/project';
import {Task} from '../api/models/task';
import {TaskStatus, TaskStatusEnum} from '../api/models/task-status';
import {ProjectService} from '../api/services/project.service';
import {DashboardTask} from './list-item/dashboard-list-item.component';

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

const displayedDueDateFormatter = new Intl.DateTimeFormat('en-AU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

type DashboardUnit = {
  projectId: number;
  code: string;
  name: string;
  tasks: DashboardTask[];
  isPrevious: boolean;
};

@Component({
  selector: 'f-cross-dashboard',
  templateUrl: './f-cross-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CrossDashboardComponent implements OnInit {
  activeUnits: DashboardUnit[] = [];
  previousUnits: DashboardUnit[] = [];

  unitScope: UnitScope = 'active';

  previousUnitsLoaded = false;
  loadingPreviousUnits = false;
  previousUnitsLoadError = false;

  filterOptions = Object.values(Filter);
  sortOptions = Object.values(SortMode);
  unitsProcessed: DashboardUnit[] = [];

  private readonly previousProjectsCache: EntityCache<Project> = new EntityCache();
  private filters: Map<number, Filter[]> = new Map();
  private sorting: Map<number, SortMode> = new Map();
  private searchTerms: Map<number, string> = new Map();

  constructor(
    private globalStateService: GlobalStateService,
    private projectService: ProjectService,
    private changeDetectorRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const requestedScope = this.route.snapshot.queryParamMap.get('scope');

    if (requestedScope === 'active' || requestedScope === 'previous' || requestedScope === 'all') {
      this.unitScope = requestedScope;
    } else {
      this.unitScope = 'active';
    }

    this.globalStateService.onLoad(() => {
      this.globalStateService.currentUserProjects.values.subscribe((projects) => {
        const activeProjects = projects.filter((project) => project.unit.isActive);
        this.activeUnits = this.mapProjects(activeProjects);
        this.processTasks();

        const needsPreviousUnits = this.unitScope === 'previous' || this.unitScope === 'all';

        if (needsPreviousUnits && !this.previousUnitsLoaded && !this.loadingPreviousUnits) {
          this.loadPreviousUnits();
        }
      });
    });
  }

  get displayedUnits(): DashboardUnit[] {
    return this.unitsProcessed;
  }

  setUnitScope(scope: UnitScope): void {
    this.unitScope = scope;

    void this.router.navigate([], {
      queryParams: {scope},
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    this.processTasks();

    const needsPreviousUnits = scope === 'previous' || scope === 'all';

    if (needsPreviousUnits && !this.previousUnitsLoaded && !this.loadingPreviousUnits) {
      this.loadPreviousUnits();
    }
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
    const searchTerm = value ?? '';

    if (this.normaliseSearchText(searchTerm).length === 0) {
      this.searchTerms.delete(project);
    } else {
      this.searchTerms.set(project, searchTerm);
    }

    this.processTasks();
  }

  getSearchTerm(project: number): string {
    return this.searchTerms.get(project) ?? '';
  }

  hasSearchTerm(project: number): boolean {
    return this.normaliseSearchText(this.getSearchTerm(project)).length > 0;
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

    this.unitsProcessed = units.map((unit) => ({
      ...unit,
      tasks: unit.tasks
        .filter((task) => {
          const filters = this.filters.get(unit.projectId) ?? [];
          const isHiddenCompletedTask =
            filters.includes(Filter.HideCompleted) && completedTypes.includes(task.status);

          return !isHiddenCompletedTask && this.taskMatchesSearch(task, unit.projectId);
        })
        .sort((a, b) => {
          const sort = this.sorting.get(unit.projectId) ?? SortMode.Recommended;

          if (completedTypes.includes(a.status) && !completedTypes.includes(b.status)) {
            return -1;
          }

          if (!completedTypes.includes(a.status) && completedTypes.includes(b.status)) {
            return 1;
          }

          switch (sort) {
            case SortMode.Recommended:
              // TODO: Connect to recommender's points.
              return 0;
            case SortMode.SubmissionDate:
              return a.dueDate.getTime() - b.dueDate.getTime();
            case SortMode.Default:
              return a.weight - b.weight;
          }

          return 0;
        }),
    }));
  }

  private taskMatchesSearch(task: DashboardTask, projectId: number): boolean {
    const searchTerm = this.normaliseSearchText(this.getSearchTerm(projectId));

    if (!searchTerm) {
      return true;
    }

    const searchableText = this.normaliseSearchText(
      [
        task.title,
        task.abbreviation,
        task.statusLabel,
        task.unitCode,
        this.formatDateForSearch(task.dueDate),
      ].join(' '),
    );

    return searchTerm.split(' ').every((term) => searchableText.includes(term));
  }

  private normaliseSearchText(value: string): string {
    return value
      .toLocaleLowerCase('en-AU')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  private formatDateForSearch(date: Date): string {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return [
      displayedDueDateFormatter.format(date),
      `${day}/${month}/${year}`,
      `${year}-${month}-${day}`,
    ].join(' ');
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
        tasks: this.mapTasks(project.activeTasks(), project.id, unit.code),
        isPrevious: !unit.isActive,
      };
    });
  }

  private mapTasks(tasks: readonly Task[], projectId: number, unitCode: string): DashboardTask[] {
    return tasks.map((task) => {
      const def = task.definition;

      return {
        title: def.name,
        subtitle: `${def.abbreviation} - ${def.targetGradeText} Task`,
        statusLabel: TaskStatus.STATUS_LABELS.get(task.status),
        abbreviation: def.abbreviation,
        color: TaskStatus.STATUS_COLORS.get(task.status),
        comments: task.numNewComments ?? 0,
        status: task.status,
        weight: task.topWeight,
        projectId,
        description: def.description,
        taskDef: def,
        unitCode,
        dueDate: def.targetDate,
      };
    });
  }
}
