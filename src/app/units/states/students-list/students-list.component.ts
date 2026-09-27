import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {MatOptionSelectionChange} from '@angular/material/core';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort, Sort} from '@angular/material/sort';
import {MatTableDataSource} from '@angular/material/table';
import {ActivatedRoute, Router} from '@angular/router';
import {Observable, Subscription, distinctUntilChanged, first, of} from 'rxjs';
import {
  Campus,
  CampusService,
  Project,
  ProjectService,
  TaskStatus,
  TaskStatusEnum,
  Tutorial,
  TutorialStream,
  Unit,
  UserService,
} from 'src/app/api/models/doubtfire-model';
import {AlertService} from 'src/app/common/services/alert.service';
import {UnitStudentEnrolmentModalService} from '../../modals/unit-student-enrolment-modal/unit-student-enrolment-modal.service';

export interface StudentProgressSegment {
  key: TaskStatusEnum;
  label: string;
  value: number;
  color: string;
}

export interface StudentProgress {
  complete: number;
  segments: StudentProgressSegment[];
  label: string;
}

export interface TutorialOptionGroup {
  label: string;
  tutorials: Tutorial[];
}

export type StudentsEmptyState = 'none' | 'no-students' | 'no-mine' | 'no-match';

// The API sends five buckets, and each one covers several task statuses, so the
// status names alone would mislabel them. These say what each bucket holds.
const PROGRESS_BUCKETS: {key: TaskStatusEnum; label: string}[] = [
  {key: 'complete', label: 'Complete'},
  {key: 'ready_for_feedback', label: 'Ready for feedback'},
  {key: 'working_on_it', label: 'Needs more work'},
  {key: 'fail', label: 'Failed or out of time'},
  {key: 'not_started', label: 'Not started or working on it'},
];

// State for both convenors and tutors to access student list
@Component({
  selector: 'f-students-list',
  templateUrl: './students-list.component.html',
  styleUrl: './students-list.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class StudentsListComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() unit$: Observable<Unit>;

  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  displayedColumns: string[] = [
    'name',
    'username',
    'stats',
    'grade',
    'portfolio',
    'similarity',
    'campus',
    'tutorial',
  ];
  dataSource: MatTableDataSource<Project> = new MatTableDataSource([]);

  searchText = '';
  staffFilter: 'all' | 'mine' = 'all';
  filteredSuggestions: string[] = [];
  loadingStudents = true;
  loadError = false;
  campuses: Campus[] = [];
  unit: Unit;

  private subscriptions: Subscription[] = [];
  private studentCacheSub?: Subscription;
  private loadSub?: Subscription;
  private progressCache: WeakMap<
    Project,
    {stats: Project['taskStats']; progress: StudentProgress}
  > = new WeakMap();
  public sortState: Sort = {active: 'name', direction: 'asc'};

  constructor(
    private enrolModal: UnitStudentEnrolmentModalService,
    private router: Router,
    private route: ActivatedRoute,
    private userService: UserService,
    private projectService: ProjectService,
    private campusService: CampusService,
    private alerts: AlertService,
  ) {}

  ngOnInit(): void {
    this.unit$ = this.unit$ ?? of(this.route.parent.snapshot.data.unit);
    this.subscriptions.push(
      this.unit$?.pipe(distinctUntilChanged((a, b) => a?.id === b?.id)).subscribe((unit) => {
        this.loadSub?.unsubscribe();
        this.studentCacheSub?.unsubscribe();
        if (!unit) {
          this.loadingStudents = true;
          this.loadError = false;
          return;
        }

        this.unit = unit;
        this.staffFilter = unit.myRole === 'Tutor' ? 'mine' : 'all';

        this.studentCacheSub = this.unit.studentCache.values.subscribe(() => {
          this.updateSuggestions();
          this.updateDataSource();
        });

        this.updateDataSource(true);
        this.loadStudents();
      }),
    );

    // Every row offers the same campus list, so ask for it once for the page.
    this.subscriptions.push(
      this.campusService.query().subscribe({
        next: (campuses) => {
          this.campuses = campuses;
        },
        error: () => {
          this.campuses = [];
        },
      }),
    );
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.updateDataSource();
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
    this.studentCacheSub?.unsubscribe();
    this.subscriptions.forEach((subscription) => subscription?.unsubscribe());
  }

  /**
   * Fetch the unit's students. A failed request used to leave the page saying no
   * students matched the filters, so it now records the failure and offers a retry.
   */
  public loadStudents(): void {
    if (!this.unit) {
      return;
    }

    // Drop a request for a unit the page has already left, so its late reply cannot
    // clear the loading state of the unit now on screen.
    this.loadSub?.unsubscribe();
    this.loadingStudents = true;
    this.loadError = false;

    this.loadSub = this.projectService
      .loadStudents(this.unit)
      .pipe(first())
      .subscribe({
        next: () => {
          this.loadingStudents = false;
        },
        error: () => {
          this.loadingStudents = false;
          this.loadError = true;
        },
        complete: () => {
          this.loadingStudents = false;
        },
      });
  }

  public onSearchChange(): void {
    this.updateSuggestions();
    this.updateDataSource(true);
  }

  public clearSearch(): void {
    this.searchText = '';
    this.onSearchChange();
  }

  public setStaffFilter(filter: 'all' | 'mine'): void {
    this.staffFilter = filter;
    this.updateDataSource(true);
  }

  public sortTableData(sort: Sort): void {
    if (!sort.active || sort.direction === '') {
      this.sortState = {active: 'name', direction: 'asc'};
    } else {
      this.sortState = sort;
    }

    this.updateDataSource();
  }

  public viewStudent(project: Project): void {
    this.router.navigate(['/projects', project.id, 'dashboard']);
  }

  public showEnrolModal(): void {
    this.enrolModal.show(this.unit);
  }

  public get totalStudents(): number {
    return this.unit?.students.length ?? 0;
  }

  public get shownStudents(): number {
    return this.dataSource.data.length;
  }

  /** Which empty message to show, so each one can offer the step that gets past it. */
  public get emptyState(): StudentsEmptyState {
    if (this.shownStudents > 0) {
      return 'none';
    }

    if (this.searchText.trim()) {
      return 'no-match';
    }

    if (this.totalStudents > 0 && this.staffFilter === 'mine') {
      return 'no-mine';
    }

    return 'no-students';
  }

  public get noMatchMessage(): string {
    return `No students match "${this.searchText.trim()}"`;
  }

  public exportCsv(): void {
    const rows = [
      this.csvHeader(),
      ...this.filteredProjects().map((project) => this.csvRow(project)),
    ];
    const csvContent = rows
      .map((row) => row.map((value) => this.csvEscape(value)).join(','))
      .join('\n');
    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.download = 'student-project-export.csv';
    link.click();

    URL.revokeObjectURL(link.href);
  }

  /**
   * The progress bar for a row. The bar used to take the grey share straight from
   * the API, which the project mapping turns from 0 into 100 for a student who has
   * submitted everything, so a finished student showed as all grey. The grey share
   * is what is left over, so it is worked out here from the other four.
   */
  public progressFor(project: Project): StudentProgress {
    const cached = this.progressCache.get(project);
    if (cached && cached.stats === project.taskStats) {
      return cached.progress;
    }

    const progress = this.buildProgress(project.taskStats);
    this.progressCache.set(project, {stats: project.taskStats, progress});
    return progress;
  }

  public sameEntity(a: {id: number} | null, b: {id: number} | null): boolean {
    return a === b || (!!a && !!b && a.id === b.id);
  }

  public changeCampus(project: Project, campus: Campus | null): void {
    const originalCampus = project.campus;

    project.switchToCampus(campus).subscribe({
      next: (updated: Project) => {
        this.alerts.success(`Campus changed for ${updated.student.displayName}`, 2000);
      },
      error: (message) => {
        project.campus = originalCampus;
        this.alerts.error(message, 6000);
      },
    });
  }

  /**
   * Option events fire for keyboard and mouse picks alike, where a click handler on
   * the option only ever saw the mouse. Programmatic changes (the select catching up
   * with the new enrolments) are not user input, so they are ignored.
   */
  public onTutorialOptionChange(
    event: MatOptionSelectionChange,
    project: Project,
    tutorial: Tutorial,
  ): void {
    if (event.isUserInput) {
      project.switchToTutorial(tutorial);
    }
  }

  /** Tutorials the student can join, grouped by stream, limited to their campus. */
  public tutorialGroupsFor(project: Project): TutorialOptionGroup[] {
    const groups: TutorialOptionGroup[] = [];
    const unstreamed = this.tutorialsFor(project);

    if (unstreamed.length > 0) {
      groups.push({label: 'No stream', tutorials: unstreamed});
    }

    (this.unit?.tutorialStreams ?? []).forEach((stream) => {
      const tutorials = this.tutorialsFor(project, stream);
      if (tutorials.length > 0) {
        groups.push({label: stream.name, tutorials});
      }
    });

    return groups;
  }

  private tutorialsFor(project: Project, stream?: TutorialStream): Tutorial[] {
    return (this.unit?.tutorials ?? []).filter((tutorial) => {
      const sameCampus =
        project.campus == null ||
        tutorial.campus == null ||
        project.campus.id === tutorial.campus.id;
      if (!sameCampus) {
        return false;
      }

      if (tutorial.tutorialStream && stream) {
        return tutorial.tutorialStream.abbreviation === stream.abbreviation;
      }

      return !tutorial.tutorialStream && !stream;
    });
  }

  private buildProgress(stats: Project['taskStats']): StudentProgress {
    const valueFor = (key: TaskStatusEnum): number => {
      const value = stats?.find((stat) => stat.key === key)?.value;
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    };

    const values: Map<TaskStatusEnum, number> = new Map();
    PROGRESS_BUCKETS.filter((bucket) => bucket.key !== 'not_started').forEach((bucket) =>
      values.set(bucket.key, valueFor(bucket.key)),
    );
    const submitted = Array.from(values.values()).reduce((sum, value) => sum + value, 0);
    values.set('not_started', Math.max(0, 100 - submitted));

    const segments = PROGRESS_BUCKETS.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      value: values.get(bucket.key),
      color: `var(--ot-status-${TaskStatus.statusClass(bucket.key)}-graphic)`,
    })).filter((segment) => segment.value > 0);

    return {
      complete: values.get('complete'),
      segments,
      label: `Progress: ${segments.map((segment) => `${segment.label} ${segment.value}%`).join(', ')}`,
    };
  }

  private updateSuggestions(): void {
    const searchValue = this.searchText.trim().toLowerCase();
    const suggestions = Array.from(new Set(this.unit?.studentFilterTypeAheadData ?? [])).filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    );

    this.filteredSuggestions = suggestions
      .filter((item) => !searchValue || item.toLowerCase().includes(searchValue))
      .slice(0, 8);
  }

  private updateDataSource(resetPagination: boolean = false): void {
    this.dataSource.data = this.filteredProjects();

    if (resetPagination) {
      this.paginator?.firstPage();
    }
  }

  private filteredProjects(): Project[] {
    const searchValue = this.searchText.trim().toLowerCase();
    const currentUser = this.userService.currentUser;

    return [...(this.unit?.students ?? [])]
      .filter((project) => (this.staffFilter === 'mine' ? project.hasTutor(currentUser) : true))
      .filter((project) => (searchValue ? this.matchesSearch(project, searchValue) : true))
      .sort((a, b) => this.compareProjects(a, b));
  }

  private matchesSearch(project: Project, searchValue: string): boolean {
    return (
      project.matches(searchValue) || project.student?.username?.toLowerCase().includes(searchValue)
    );
  }

  private compareProjects(a: Project, b: Project): number {
    const direction = this.sortState.direction === 'desc' ? -1 : 1;
    const aValue = this.sortValue(a, this.sortState.active);
    const bValue = this.sortValue(b, this.sortState.active);

    if (aValue === bValue) {
      return 0;
    }

    if (aValue == null) {
      return -1 * direction;
    }

    if (bValue == null) {
      return 1 * direction;
    }

    return aValue < bValue ? -1 * direction : 1 * direction;
  }

  private sortValue(project: Project, active: string): number | string {
    switch (active) {
      case 'username':
        return project.student?.username?.toLowerCase() || '';
      case 'name':
        return project.student?.displayName?.toLowerCase() || '';
      case 'stats':
        return project.orderScale ?? 0;
      case 'grade':
        return project.targetGrade ?? -1;
      case 'portfolio':
        return project.portfolioStatus ?? -1;
      case 'similarity':
        return project.similarityFlag ? 1 : 0;
      case 'campus':
        return project.campus?.name?.toLowerCase() || '';
      case 'tutorial':
        return project.shortTutorialDescription().toLowerCase();
      default:
        return project.student?.displayName?.toLowerCase() || '';
    }
  }

  private csvHeader(): string[] {
    const result = ['username', 'name', 'email', 'portfolio'];

    if (this.unit.tutorialStreamsCache.size > 0) {
      this.unit.tutorialStreams.forEach((stream) => result.push(stream.abbreviation));
    } else {
      result.push('tutorial');
    }

    return result;
  }

  private csvRow(project: Project): string[] {
    const row = [
      project.student?.username || '',
      project.student?.displayName || '',
      project.student?.email || '',
      String(project.portfolioStatus ?? ''),
    ];

    if (this.unit.tutorialStreamsCache.size > 0) {
      this.unit.tutorialStreams.forEach((stream) => {
        row.push(project.tutorialForStream(stream)?.abbreviation || '');
      });
    } else {
      row.push(project.tutorials[0]?.abbreviation || '');
    }

    return row;
  }

  private csvEscape(value: string): string {
    const normalized = String(value ?? '');
    if (/[",\n]/.test(normalized)) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }
    return normalized;
  }
}
