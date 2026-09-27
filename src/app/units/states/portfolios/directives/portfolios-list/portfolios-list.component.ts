import {_isNumberValue} from '@angular/cdk/coercion';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {MatPaginator, PageEvent} from '@angular/material/paginator';
import {MatSort, Sort} from '@angular/material/sort';
import {MatTableDataSource} from '@angular/material/table';
import {Project} from 'src/app/api/models/project';
import {TaskStatus, TaskStatusEnum} from 'src/app/api/models/task-status';
import {Unit} from 'src/app/api/models/unit';
import {UnitService} from 'src/app/api/services/unit.service';
import {UserService} from 'src/app/api/services/user.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {SidekiqProgressModalService} from 'src/app/common/modals/sidekiq-progress-modal/sidekiq-progress-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {D2lTransferModal} from '../../d2l-transfer-modal/d2l-transfer.component';
import {isProjectGraded} from '../../portfolio-grades';
import {
  DEFAULT_PORTFOLIO_LIST_VIEW,
  PortfolioMarkingStateService,
} from '../../portfolio-marking-state.service';

export interface PortfolioListFilters {
  portfolioFilter: 'all' | 'submitted_only';
  tutorialFilter: 'all' | 'mine';
  gradeFilter: number | null;
  filterText: string;
}

export const DEFAULT_PORTFOLIO_LIST_FILTERS: PortfolioListFilters = {
  portfolioFilter: 'submitted_only',
  tutorialFilter: 'all',
  gradeFilter: null,
  filterText: '',
};

export interface PortfolioProgressSegment {
  key: TaskStatusEnum;
  label: string;
  value: number;
  color: string;
}

export interface PortfolioProgress {
  complete: number;
  segments: PortfolioProgressSegment[];
  label: string;
}

export type PortfolioListEmptyReason = 'no-students' | 'no-portfolios' | 'no-matches';

// The statuses drawn on the progress bar, in the order they sit from the left. Tasks
// not started are the empty track after them.
const PROGRESS_STATUSES: TaskStatusEnum[] = [
  'complete',
  'ready_for_feedback',
  'working_on_it',
  'fail',
];

// One shared stand-in for a project with no stats yet, so its bar is worked out once.
const NO_STATS: Project['taskStats'] = [];

// The url keeps the search trimmed, so a search that differs only by spaces at its ends
// is the same search.
export function sameFilters(
  a: PortfolioListFilters | null | undefined,
  b: PortfolioListFilters | null | undefined,
): boolean {
  if (!a || !b) {
    return a === b;
  }

  return (
    a.portfolioFilter === b.portfolioFilter &&
    a.tutorialFilter === b.tutorialFilter &&
    a.gradeFilter === b.gradeFilter &&
    a.filterText.trim() === b.filterText.trim()
  );
}

@Component({
  selector: 'f-portfolios-list',
  templateUrl: './portfolios-list.component.html',
  styleUrl: './portfolios-list.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PortfoliosListComponent implements OnChanges {
  @Input() unit: Unit;
  @Input() loading = true;
  @Input() loadError = false;
  @Input() filters: PortfolioListFilters = DEFAULT_PORTFOLIO_LIST_FILTERS;

  @Output()
  public studentSelected: EventEmitter<Project> = new EventEmitter();
  @Output()
  public filtersChange: EventEmitter<PortfolioListFilters> = new EventEmitter();
  // Asks the page to fetch the students again, after a failed load or a grades upload.
  @Output()
  public reload: EventEmitter<void> = new EventEmitter();

  displayedColumns: string[] = [];

  dataSource: MatTableDataSource<Project> = new MatTableDataSource([]);

  public portfolioFilter: 'all' | 'submitted_only' = 'submitted_only';
  public tutorialFilter: 'all' | 'mine' = 'all';
  public gradeFilter: number | null = null;
  public filterText = '';

  public studentCount = 0;
  public portfolioCount = 0;

  // The sort and page the tutor left the list on, restored from the marking state when
  // they come back from a student.
  public sortActive = DEFAULT_PORTFOLIO_LIST_VIEW.sortActive;
  public sortDirection: 'asc' | 'desc' = DEFAULT_PORTFOLIO_LIST_VIEW.sortDirection;
  public pageIndex = DEFAULT_PORTFOLIO_LIST_VIEW.pageIndex;
  public pageSize = DEFAULT_PORTFOLIO_LIST_VIEW.pageSize;

  private matSort: MatSort | null = null;
  private progressCache: WeakMap<object, PortfolioProgress> = new WeakMap();

  constructor(
    private userService: UserService,
    private gradeService: GradeService,
    private fileDownloaderService: FileDownloaderService,
    private unitService: UnitService,
    private alertService: AlertService,
    private sidekiq: SidekiqProgressModalService,
    private d2lTransferModal: D2lTransferModal,
    private markingState: PortfolioMarkingStateService,
  ) {
    this.dataSource.sortingDataAccessor = (project, column) => this.sortValue(project, column);
  }

  // The table stays in the page while it is hidden, so these are found on the first
  // check. Setting them on the data source makes it sort and page every change of data,
  // including the first, so the order always matches the arrow on the header.
  @ViewChild(MatPaginator) set paginator(paginator: MatPaginator | undefined) {
    this.dataSource.paginator = paginator ?? null;
  }

  @ViewChild(MatSort) set sort(sort: MatSort | undefined) {
    this.matSort = sort ?? null;
    this.dataSource.sort = this.matSort;
  }

  @ViewChild('heading') private heading?: ElementRef<HTMLElement>;

  public focusHeading(): void {
    this.heading?.nativeElement.focus({preventScroll: true});
  }

  ngOnChanges(changes: SimpleChanges): void {
    const unitChanged =
      !!changes.unit && !!this.unit && changes.unit.previousValue?.id !== this.unit.id;
    if (unitChanged) {
      this.restoreListView(!changes.unit.firstChange);
    }

    // Different filters send the list back to its first page. The first filters a new
    // list is given are not a change, so coming back from a student keeps the page.
    let filtersChanged = false;
    if (changes.filters && this.filters) {
      filtersChanged =
        !changes.filters.firstChange && !sameFilters(changes.filters.previousValue, this.filters);
      this.portfolioFilter = this.filters.portfolioFilter;
      this.tutorialFilter = this.filters.tutorialFilter;
      this.gradeFilter = this.filters.gradeFilter;
      this.filterText = this.filters.filterText;
    }

    if (!this.loading && this.unit && (changes.loading || changes.unit || changes.filters)) {
      this.updateDataSource();
    }

    // Filters that arrive with another unit are that unit's own, not an edit, so its
    // remembered page stands. It is kept inside that unit's rows when they are shown.
    if (filtersChanged && !unitChanged) {
      this.goToFirstPage();
    }
  }

  public onSortChange(sort: Sort): void {
    this.sortActive = sort.active;
    this.sortDirection = sort.direction === 'desc' ? 'desc' : 'asc';
    this.rememberListView();
  }

  public onPage(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.rememberListView();
  }

  public get hasRows(): boolean {
    return this.dataSource.filteredData.length > 0;
  }

  public get hasActiveFilters(): boolean {
    return (
      this.portfolioFilter !== DEFAULT_PORTFOLIO_LIST_FILTERS.portfolioFilter ||
      this.tutorialFilter !== DEFAULT_PORTFOLIO_LIST_FILTERS.tutorialFilter ||
      this.gradeFilter !== DEFAULT_PORTFOLIO_LIST_FILTERS.gradeFilter ||
      this.filterText.trim() !== ''
    );
  }

  // Why the table is empty decides what the page offers next: nothing to do when the
  // unit has no students, a way to see everyone when nobody has submitted yet, and a
  // way to clear the filters when they hide everyone.
  public get emptyReason(): PortfolioListEmptyReason {
    if (this.studentCount === 0) {
      return 'no-students';
    }

    const onlyPortfolioFilter =
      this.portfolioFilter === 'submitted_only' &&
      this.tutorialFilter === 'all' &&
      this.gradeFilter === null &&
      this.filterText.trim() === '';

    if (onlyPortfolioFilter && this.portfolioCount === 0) {
      return 'no-portfolios';
    }

    return 'no-matches';
  }

  public get summary(): string {
    const students = `${this.studentCount} ${this.studentCount === 1 ? 'student' : 'students'}`;
    if (this.studentCount === 0) {
      return 'No students are enrolled in this unit yet.';
    }

    return `${this.portfolioCount} of ${students} ${this.portfolioCount === 1 ? 'has' : 'have'} submitted a portfolio.`;
  }

  openProject(event: Event, project: Project) {
    event.stopPropagation();
    window.open(`/projects/${project.id}/dashboard/?tutor=true`, '_blank');
  }

  downloadGrades() {
    this.fileDownloaderService.downloadFile(this.unit.gradesUrl, `${this.unit.code}-grades.csv`);
  }

  downloadPortfolios() {
    this.unitService.zipPortfolios(this.unit).subscribe({
      next: (newJob) => {
        this.sidekiq.show(`Downloading Portfolios: ${this.unit.code}`, newJob.id).subscribe({
          next: () => {
            this.fileDownloaderService.downloadFile(
              this.unit.portfoliosUrl,
              `${this.unit.code}-portfolios.zip`,
            );
          },
          error: (error) => {
            this.alertService.error(error, 6000);
          },
        });
      },
      error: (error) => {
        this.alertService.error(`Could not download portfolios: ${error}`, 6000);
      },
    });
  }

  downloadStaffNotes() {
    this.unit.downloadStaffNotesCsv();
  }

  public hasD2lMapping() {
    return this.unit?.hasD2lMapping() ?? false;
  }

  transferToD2l() {
    this.d2lTransferModal.open(this.unit);
  }

  public get gradeValues() {
    return this.gradeService.gradeValuesFor(this.unit);
  }

  public gradeLabel(grade) {
    return this.gradeService.gradeLabel(grade, this.unit);
  }

  public isGraded(project: Project): boolean {
    return isProjectGraded(project);
  }

  public hasSubmittedGrade(project: Project): boolean {
    return project.submittedGrade !== null && project.submittedGrade !== undefined;
  }

  updateDataSource() {
    if (!this.unit) {
      return;
    }

    const currentUser = this.userService.currentUser;
    const allStudents = this.unit.students ?? [];

    // The search is applied here with the other filters, not by the data source. Setting
    // its filter and its rows one after the other made it work out the page twice, and
    // the first answer, from the old rows, could land last and move the tutor's page.
    const search = this.filterText.trim().toLowerCase();
    const students = allStudents
      .filter((p) =>
        this.portfolioFilter === 'submitted_only' ? p.hasPortfolio || p.portfolioAvailable : true,
      )
      .filter((p) => (this.tutorialFilter === 'mine' ? p.hasTutor(currentUser) : true))
      .filter((p) => (this.gradeFilter !== null ? p.submittedGrade === this.gradeFilter : true))
      .filter((p) => !search || this.searchText(p).includes(search));

    this.displayedColumns = [
      'name',
      'student',
      'tutor',
      'tutorial',
      'target',
      'submitted-as',
      'submission-date',
      ...(this.portfolioFilter === 'all' ? ['has-portfolio'] : []),
      'stats',
      'grade',
      'actions',
    ];

    this.studentCount = allStudents.length;
    this.portfolioCount = allStudents.filter((p) => p.hasPortfolio || p.portfolioAvailable).length;

    // The list stays on its page when the rows change, so a reload after a grades upload
    // does not lose the tutor's place. The page is pulled back inside the rows there are
    // now, here rather than by the data source, which does it without saying so. It
    // also quietly drops a restored page to the first while the table is still empty,
    // so the page is put back before the rows arrive.
    const lastPage = Math.max(0, Math.ceil(students.length / this.pageSize) - 1);
    if (this.pageIndex > lastPage) {
      this.pageIndex = lastPage;
      this.rememberListView();
    }

    if (this.dataSource.paginator && this.dataSource.paginator.pageIndex !== this.pageIndex) {
      this.dataSource.paginator.pageIndex = this.pageIndex;
    }
    this.dataSource.data = students;
  }

  onPortfolioFilterChange(event: {value: 'all' | 'submitted_only'}) {
    this.portfolioFilter = event.value;
    this.updateDataSource();
    this.goToFirstPage();
    this.emitFilters();
  }

  onTutorialFilterChange(event: {value: 'all' | 'mine'}) {
    this.tutorialFilter = event.value;
    this.updateDataSource();
    this.goToFirstPage();
    this.emitFilters();
  }

  onGradeFilterChange(event: {value: number | null}) {
    this.gradeFilter = event.value;
    this.updateDataSource();
    this.goToFirstPage();
    this.emitFilters();
  }

  applyFilter(event: Event) {
    this.filterText = (event.target as HTMLInputElement).value;
    this.updateDataSource();
    this.goToFirstPage();
    this.emitFilters();
  }

  showAllStudents() {
    this.onPortfolioFilterChange({value: 'all'});
  }

  clearFilters() {
    this.portfolioFilter = DEFAULT_PORTFOLIO_LIST_FILTERS.portfolioFilter;
    this.tutorialFilter = DEFAULT_PORTFOLIO_LIST_FILTERS.tutorialFilter;
    this.gradeFilter = DEFAULT_PORTFOLIO_LIST_FILTERS.gradeFilter;
    this.filterText = DEFAULT_PORTFOLIO_LIST_FILTERS.filterText;
    this.updateDataSource();
    this.goToFirstPage();
    this.emitFilters();
  }

  selectStudent(project: Project) {
    this.studentSelected.emit(project);
  }

  // Tasks not started are left as the empty track, and worked out from the rest, because
  // the stats can say none are started when every task is (a zero there reads as 100%).
  public progressFor(project: Project): PortfolioProgress {
    const stats = project.taskStats ?? NO_STATS;
    const cached = this.progressCache.get(stats);
    if (cached) {
      return cached;
    }

    const value = (key: TaskStatusEnum) =>
      Math.max(0, stats.find((stat) => stat.key === key)?.value ?? 0);

    const segments = PROGRESS_STATUSES.map((key) => ({
      key,
      label: TaskStatus.STATUS_LABELS.get(key) ?? key,
      value: value(key),
      color: `var(--ot-status-${TaskStatus.statusClass(key)}-graphic)`,
    })).filter((segment) => segment.value > 0);

    const drawn = segments.reduce((total, segment) => total + segment.value, 0);
    const notStarted = Math.max(0, 100 - drawn);
    const parts = segments.map((segment) => `${segment.label} ${segment.value}%`);
    if (notStarted > 0) {
      parts.push(`${TaskStatus.STATUS_LABELS.get('not_started') ?? 'Not started'} ${notStarted}%`);
    }

    const progress: PortfolioProgress = {
      complete: value('complete'),
      segments,
      label: `Task progress: ${parts.join(', ')}`,
    };
    this.progressCache.set(stats, progress);

    return progress;
  }

  private goToFirstPage() {
    this.pageIndex = 0;
    this.dataSource.paginator?.firstPage();
    this.rememberListView();
  }

  private rememberListView() {
    if (!this.unit) {
      return;
    }

    this.markingState.rememberListView(this.unit.id, {
      sortActive: this.sortActive,
      sortDirection: this.sortDirection,
      pageIndex: this.pageIndex,
      pageSize: this.pageSize,
    });
  }

  // Bound to the sort header and paginator. The first time they are read as the table is
  // built. On a later unit change the sort has to be applied, because the table only
  // re-sorts when the sort announces a change.
  private restoreListView(applyToTable: boolean) {
    const view = this.markingState.listViewFor(this.unit.id);
    this.sortActive = view.sortActive;
    this.sortDirection = view.sortDirection;
    this.pageIndex = view.pageIndex;
    this.pageSize = view.pageSize;

    if (applyToTable && this.dataSource.paginator) {
      this.dataSource.paginator.pageIndex = view.pageIndex;
      this.dataSource.paginator.pageSize = view.pageSize;
    }

    if (applyToTable && this.matSort) {
      this.matSort.active = view.sortActive;
      this.matSort.direction = view.sortDirection;
      this.matSort.sortChange.emit({active: view.sortActive, direction: view.sortDirection});
    }
  }

  private emitFilters() {
    this.filtersChange.emit({
      portfolioFilter: this.portfolioFilter,
      tutorialFilter: this.tutorialFilter,
      gradeFilter: this.gradeFilter,
      filterText: this.filterText,
    });
  }

  private searchText(project: Project): string {
    return [
      project.student?.studentId,
      project.student?.username,
      project.student?.name,
      project.tutorNames(),
      project.shortTutorialDescription(),
      String(project.grade),
    ]
      .join(' ')
      .toLowerCase();
  }

  private sortDateValue(value: Date | string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  private sortValue(project: Project, column: string): string | number {
    switch (column) {
      case 'student': {
        const id = project.student?.studentId || project.student?.username || '';
        return _isNumberValue(id) ? Number(id) : id.toLowerCase();
      }
      case 'name':
        return (project.student?.name ?? '').toLowerCase();
      case 'tutor':
        return project.tutorNames().toLowerCase();
      case 'tutorial':
        return project.shortTutorialDescription().toLowerCase();
      case 'target':
        return project.targetGrade ?? -2;
      case 'submitted-as':
        return project.submittedGrade ?? -2;
      case 'submission-date':
        return this.sortDateValue(project.portfolioSubmissionDate);
      case 'has-portfolio':
        return project.hasPortfolio ? 1 : 0;
      case 'grade':
        return this.isGraded(project) ? project.grade : -1;
      default:
        return '';
    }
  }
}
