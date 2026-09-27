import {EntityCache} from 'ngx-entity-service';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort} from '@angular/material/sort';
import {MatTable, MatTableDataSource} from '@angular/material/table';
import {ActivatedRoute} from '@angular/router';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';
import {UnitRole} from 'src/app/api/models/unit-role';
import {User} from 'src/app/api/models/user/user';
import {ProjectService} from 'src/app/api/services/project.service';
import {UnitService} from 'src/app/api/services/unit.service';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {CreateNewUnitModal} from '../../modals/create-new-unit-modal/create-new-unit-modal.component';

interface IUnitOrProject {
  id: number;
  unit_code: string;
  code: string;
  name: string;
  unit_role?: string;
  teaching_period: string;
  start_date: Date;
  end_date: Date;
  // Whether the unit is running now: its own active flag, and its teaching period if it
  // has one. The Active column always meant this, but it read a field the rows never had.
  active: boolean;
  user?: User;
  unit?: Unit;
  student?: User;
  matchesTutorialEnrolments?: (filter: string) => boolean;
  matchesGroup?: (filter: string) => boolean;
  matches: (filter: string) => boolean;
}

type UnitsMode = 'admin' | 'tutor' | 'student';

const PAGE_COPY: Record<UnitsMode, {title: string; description: string; noun: string}> = {
  tutor: {
    title: 'Units you teach',
    description: 'Every unit you have taught, including earlier teaching periods.',
    noun: 'units you teach',
  },
  admin: {
    title: 'Units',
    description: 'Every unit, active or not. Open one to manage it.',
    noun: 'units',
  },
  student: {
    title: 'Your units',
    description: 'Every unit you have studied, including earlier teaching periods.',
    noun: 'units',
  },
};

@Component({
  selector: 'f-units',
  templateUrl: './units.component.html',
  styleUrls: ['./units.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class FUnitsComponent implements OnInit, AfterViewInit {
  @ViewChild(MatTable, {static: false}) table: MatTable<Unit>;
  @ViewChild(MatSort, {static: false}) sort: MatSort;
  @ViewChild(MatPaginator, {static: false}) paginator: MatPaginator;

  @Input({required: true}) mode: UnitsMode;

  displayedColumns: string[] = [
    'unit_code',
    'name',
    'unit_role',
    'teaching_period',
    'start_date',
    'end_date',
    'active',
  ];

  // the datasource of the table
  dataSource: MatTableDataSource<IUnitOrProject> = new MatTableDataSource([]);

  title: string;
  description: string;

  /** True until the first list of units arrives. */
  loading = true;
  /** Set when the request behind this list fails, so the page can offer to retry. */
  loadError = false;

  filterText = '';

  private readonly destroyRef = inject(DestroyRef);

  // A student's own project list in the global state only holds active units, so the
  // full history is fetched into a cache of its own, the way the dashboard does it.
  private readonly allProjectsCache: EntityCache<Project> = new EntityCache();

  shouldShowUnitRoleColumn(): boolean {
    return this.mode === 'admin' || this.mode === 'tutor';
  }

  constructor(
    private createUnitDialog: CreateNewUnitModal,
    private globalStateService: GlobalStateService,
    private unitService: UnitService,
    private projectService: ProjectService,
    private route: ActivatedRoute,
  ) {}

  units: IUnitOrProject[] = [];

  ngOnInit(): void {
    this.mode = this.mode ?? this.route.snapshot.data.mode;
    const copy = PAGE_COPY[this.mode] ?? PAGE_COPY.student;
    this.title = copy.title;
    this.description = copy.description;

    if (!this.shouldShowUnitRoleColumn()) {
      this.displayedColumns = this.displayedColumns.filter((column) => column !== 'unit_role');
    }

    if (this.mode === 'tutor') {
      this.globalStateService.onLoad(() => {
        this.globalStateService.loadedUnitRoles.values
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (unitRoles) => this.showRows(unitRoles),
          });
      });
    }
    if (this.mode === 'admin') {
      this.globalStateService.onLoad(() => {
        this.globalStateService.loadedUnits.values
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((units) => this.showRows(units, false));
        this.loadAllUnits();
      });
    } else if (this.mode === 'student') {
      this.globalStateService.onLoad(() => {
        this.globalStateService.currentUserProjects.values
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((projects) => {
            // Show the active units straight away, until the full history arrives.
            if (this.allProjectsCache.size === 0) {
              this.showRows(projects, false);
            }
          });
        this.allProjectsCache.values
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((projects) => {
            if (this.allProjectsCache.size > 0) {
              this.showRows(projects);
            }
          });
        this.loadAllProjects();
      });
    }
  }

  get noun(): string {
    return (PAGE_COPY[this.mode] ?? PAGE_COPY.student).noun;
  }

  get summary(): string {
    const rows = this.dataSource.data;
    const active = rows.filter((row) => row.active).length;
    return `${rows.length} ${rows.length === 1 ? 'unit' : 'units'} · ${active} active`;
  }

  get isFiltered(): boolean {
    return this.filterText.trim().length > 0;
  }

  retry(): void {
    if (this.mode === 'admin') {
      this.loadAllUnits();
    } else if (this.mode === 'student') {
      this.loadAllProjects();
    }
  }

  routeFor(row: IUnitOrProject): (string | number)[] {
    if (this.mode === 'admin') {
      return ['/units', row.id, 'admin'];
    }
    if (this.mode === 'student') {
      return ['/projects', row.id, 'dashboard'];
    }
    return ['/units', row.id, 'tasks', 'inbox'];
  }

  mapUnitSourceToColumn(unitOrProject: Unit | Project | UnitRole): IUnitOrProject {
    if (unitOrProject instanceof Unit) {
      return {
        id: unitOrProject.id,
        unit_code: unitOrProject.code,
        code: unitOrProject.code,
        name: unitOrProject.name,
        unit_role: unitOrProject.myRole,
        teaching_period: unitOrProject.teachingPeriod?.name || 'Custom',
        start_date: unitOrProject.startDate,
        end_date: unitOrProject.endDate,
        active: unitOrProject.isActive,
        matches: (filter: string) => unitOrProject.matches(filter),
      };
    } else if (unitOrProject instanceof Project) {
      return {
        id: unitOrProject.id,
        unit_code: unitOrProject.unit.code,
        code: unitOrProject.unit.code,
        name: unitOrProject.unit.name,
        teaching_period: unitOrProject.unit.teachingPeriod?.name,
        start_date: unitOrProject.unit.startDate,
        end_date: unitOrProject.unit.endDate,
        active: unitOrProject.unit.isActive,
        student: unitOrProject.student,
        matchesTutorialEnrolments: unitOrProject.matchesTutorialEnrolments,
        matchesGroup: unitOrProject.matchesGroup,
        matches: (filter: string) => {
          // A student's own project carries a user id rather than a student, and the
          // user is filled in later, so it may not be there yet when someone searches.
          return (
            unitOrProject.unit.matches(filter) ||
            !!unitOrProject.student?.matches(filter) ||
            unitOrProject.matchesTutorialEnrolments(filter) ||
            unitOrProject.matchesGroup(filter)
          );
        },
      };
    } else if (unitOrProject instanceof UnitRole) {
      return {
        id: unitOrProject.unit.id,
        unit_code: unitOrProject.unit.code,
        code: unitOrProject.unit.code,
        name: unitOrProject.unit.name,
        unit_role: unitOrProject.role,
        teaching_period: unitOrProject.unit.teachingPeriod?.name,
        start_date: unitOrProject.unit.startDate,
        end_date: unitOrProject.unit.endDate,
        active: unitOrProject.unit.isActive,
        user: unitOrProject.user,
        unit: unitOrProject.unit,
        matches: (filter: string) =>
          unitOrProject.unit.matches(filter) || !!unitOrProject.user?.matches(filter),
      };
    }
  }

  mapUnitOrProjectsToColumns(unitOrProjects: readonly (Unit | Project | UnitRole)[]) {
    // Skip anything that has not been mapped far enough to have a unit yet.
    return [...unitOrProjects]
      .filter((source) => (source instanceof Unit ? source.code : source?.unit?.code))
      .map((unitOrProject) => this.mapUnitSourceToColumn(unitOrProject));
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = (data, filter: string) => data.matches(filter);
    this.dataSource.sortingDataAccessor = (data, column) => this.sortValue(data, column);
  }

  createUnit() {
    this.createUnitDialog.show();
  }

  applyFilter(event: Event) {
    this.filterText = (event.target as HTMLInputElement).value ?? '';
    this.dataSource.filter = this.filterText.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * The value the table sorts a column on. Text sorts without regard to case, dates by
   * time, and a missing value sorts as empty rather than breaking the comparison.
   */
  sortValue(data: IUnitOrProject, column: string): string | number {
    switch (column) {
      case 'start_date':
      case 'end_date': {
        const date = data[column];
        return date instanceof Date ? date.getTime() : 0;
      }
      case 'active':
        return data.active ? 1 : 0;
      default: {
        const value = data[column as keyof IUnitOrProject];
        return typeof value === 'string' ? value.toLowerCase() : '';
      }
    }
  }

  private showRows(sources: readonly (Unit | Project | UnitRole)[], finishedLoading = true) {
    this.dataSource.data = this.mapUnitOrProjectsToColumns(sources ?? []);
    if (finishedLoading) {
      this.loading = false;
    }
  }

  private loadAllUnits(): void {
    this.loading = true;
    this.loadError = false;
    this.unitService.query(undefined, {params: {include_in_active: true}}).subscribe({
      next: () => (this.loading = false),
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  private loadAllProjects(): void {
    this.loading = true;
    this.loadError = false;
    this.projectService
      .query(undefined, {
        cache: this.allProjectsCache,
        params: {include_inactive: true, include_task_definitions: true},
      })
      .subscribe({
        next: () => (this.loading = false),
        error: () => {
          this.loading = false;
          this.loadError = true;
        },
      });
  }
}
