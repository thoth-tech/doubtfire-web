import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import {BehaviorSubject, Observable, Subscription, distinctUntilChanged, of} from 'rxjs';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';
import {ProjectService} from 'src/app/api/services/project.service';
import {UserService} from 'src/app/api/services/user.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {
  DEFAULT_PORTFOLIO_LIST_FILTERS,
  PortfolioListFilters,
  PortfoliosListComponent,
  sameFilters,
} from './directives/portfolios-list/portfolios-list.component';
import {gradeBandFor, isProjectGraded} from './portfolio-grades';
import {PortfolioMarkingStateService} from './portfolio-marking-state.service';

type PortfolioTabKey = 'select' | 'progress' | 'student-notes' | 'portfolio' | 'assessment';

interface PortfolioTab {
  label: string;
  routeSegment: PortfolioTabKey;
  requiresProject: boolean;
}

// The query parameters that carry the list filters, so a student route can tell a url
// that sets filters apart from one that just dropped them.
const FILTER_QUERY_PARAMS = ['portfolio', 'tutorial', 'grade', 'search'];

@Component({
  selector: 'f-portfolios',
  templateUrl: './portfolios.component.html',
  styleUrl: './portfolios.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PortfoliosComponent implements OnInit, AfterViewChecked, OnDestroy {
  @Input() unit$: Observable<Unit>;

  @ViewChild(PortfoliosListComponent) private portfoliosList?: PortfoliosListComponent;
  @ViewChild('studentHeading') private studentHeading?: ElementRef<HTMLElement>;

  public readonly tabs: PortfolioTab[] = [
    {label: 'All students', routeSegment: 'select', requiresProject: false},
    {label: 'Progress', routeSegment: 'progress', requiresProject: true},
    {label: 'Staff notes', routeSegment: 'student-notes', requiresProject: true},
    {label: 'Portfolio', routeSegment: 'portfolio', requiresProject: true},
    {label: 'Grade', routeSegment: 'assessment', requiresProject: true},
  ];
  public readonly studentTabs: PortfolioTab[] = this.tabs.filter((tab) => tab.requiresProject);

  public unit: Unit = null;
  public selectedProject: Project | null = null;
  public selectedProject$: BehaviorSubject<Project | null> = new BehaviorSubject(null);
  public loadingStudents = true;
  public studentsLoadFailed = false;
  public projectLoadFailed = false;
  public currentTab: PortfolioTab = this.tabs[0];
  public portfolioListFilters: PortfolioListFilters = {...DEFAULT_PORTFOLIO_LIST_FILTERS};

  // The student view's links, rebuilt only when what they point at changes, so the
  // router links are not handed a new array on every check.
  public listLink: unknown[] = [];
  public listQueryParams: Record<string, string | number | null> = {};
  public tabLinks: Partial<Record<PortfolioTabKey, unknown[]>> = {};

  private subscriptions: Subscription[] = [];
  private studentsLoad: Subscription | null = null;
  private projectLoad: Subscription | null = null;
  private selectedProjectId: number | null = null;
  private progressTaskSelectionUrlBaseCache: unknown[] | null = null;
  private progressTaskSelectionUrlBaseKey: string | null = null;
  private tabLinksKey: string | null = null;
  private routeParamsSubscribed = false;
  private routeSeen = false;
  private focusTarget: 'list' | 'student' | null = null;

  constructor(
    private projectService: ProjectService,
    private router: Router,
    private route: ActivatedRoute,
    private alertService: AlertService,
    private userService: UserService,
    private gradeService: GradeService,
    private markingState: PortfolioMarkingStateService,
  ) {}

  public ngOnInit(): void {
    this.listQueryParams = this.portfolioListFilterQueryParams();
    this.unit$ = this.unit$ ?? of(this.route.parent.snapshot.data.unit);
    this.subscriptions.push(
      this.unit$.pipe(distinctUntilChanged((a, b) => a?.id === b?.id)).subscribe({
        next: (unit) => {
          const unitChanged = this.unit != null && this.unit.id !== unit.id;
          this.unit = unit;
          this.listLink = ['/units', unit.id, 'students', 'portfolios'];

          if (unitChanged) {
            this.resetStudentSelection();
          }

          if (
            this.userService.currentUser.systemRole === 'Admin' ||
            this.userService.currentUser.systemRole === 'Convenor'
          ) {
            // A unit with no D2L link, or one this convenor cannot edit, answers with an
            // error. That only means there is nothing to transfer to, so the transfer
            // button stays hidden instead of the error landing in the console.
            this.subscriptions.push(this.unit.loadD2lMapping().subscribe({error: () => {}}));
          }

          this.loadStudents();
          this.subscribeToRouteParams();
        },
        error: (error) => {
          this.alertService.error(`Failed to load unit: ${error}`, 6000);
          this.router.navigateByUrl('/home');
        },
      }),
    );
  }

  // The list, a student and a task are separate routes, so moving between them builds
  // this page again and the control the tutor used goes with the old one. Focus would be
  // left on the page itself, so it goes to the heading of the view that appeared. Focus
  // that is still on something is left alone, and the page is not scrolled to it.
  public ngAfterViewChecked(): void {
    if (!this.focusTarget) {
      return;
    }

    const active = document.activeElement;
    if (active && active !== document.body) {
      this.focusTarget = null;
      return;
    }

    if (this.focusTarget === 'list' && this.portfoliosList) {
      this.focusTarget = null;
      this.portfoliosList.focusHeading();
    } else if (this.focusTarget === 'student' && this.studentHeading) {
      this.focusTarget = null;
      this.studentHeading.nativeElement.focus({preventScroll: true});
    }
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.studentsLoad?.unsubscribe();
    this.projectLoad?.unsubscribe();
  }

  public get progressTaskSelectionUrlBase(): unknown[] | null {
    if (!this.unit || !this.selectedProject) {
      return null;
    }

    // Cache the array so the binding keeps the same reference between change detection passes.
    // A new literal each call makes the input dirty every check, which pushes the progress tab
    // to re-emit its project over and over.
    const key = `${this.unit.id}/${this.selectedProject.id}`;
    if (key !== this.progressTaskSelectionUrlBaseKey) {
      this.progressTaskSelectionUrlBaseKey = key;
      this.progressTaskSelectionUrlBaseCache = [
        '/units',
        this.unit.id,
        'students',
        'portfolios',
        this.selectedProject.id,
        'progress',
      ];
    }

    return this.progressTaskSelectionUrlBaseCache;
  }

  // Read the same way as the portfolio tab, so the header never says a portfolio is
  // there when the tab says it is not.
  public get portfolioStatus(): 'ready' | 'building' | 'none' {
    const project = this.selectedProject;
    if (project?.portfolioAvailable) {
      return 'ready';
    }

    return project?.compilePortfolio ? 'building' : 'none';
  }

  public get hasSubmittedGrade(): boolean {
    const grade = this.selectedProject?.submittedGrade;
    return grade !== null && grade !== undefined;
  }

  public get studentGrade(): string | null {
    if (!isProjectGraded(this.selectedProject)) {
      return null;
    }

    const grade = this.selectedProject.grade;
    const band = gradeBandFor(grade);
    const bandLabel = band ? (this.gradeLabel(band.gradeValue) ?? band.name) : null;
    return bandLabel ? `${grade} · ${bandLabel}` : `${grade}`;
  }

  public gradeLabel(grade: number | null | undefined): string | undefined {
    if (grade === null || grade === undefined) {
      return undefined;
    }

    return this.gradeService.gradeLabel(grade, this.unit);
  }

  public studentSelected(project: Project): void {
    this.navigateToProject(project.id, 'progress');
  }

  public showProgress(): void {
    if (this.selectedProject) {
      this.navigateToProject(this.selectedProject.id, 'progress');
    }
  }

  // Asked for after a failed load or a grades upload, so it goes to the server: the
  // cached answer is the one the tutor already has.
  public reloadStudents(): void {
    this.loadStudents(true);
  }

  public retryProject(): void {
    if (this.selectedProjectId) {
      this.loadProject(this.selectedProjectId);
    }
  }

  public portfolioListFiltersChange(filters: PortfolioListFilters): void {
    this.portfolioListFilters = {...filters};
    this.listQueryParams = this.portfolioListFilterQueryParams();
    this.markingState.rememberFilters(this.unit.id, this.portfolioListFilters);

    if (this.currentTab.routeSegment === 'select') {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: this.listQueryParams,
        replaceUrl: true,
      });
    }
  }

  // The selected student belongs to the unit we just left, so drop it and go back to
  // the student list rather than showing someone who is not enrolled in the new unit.
  private resetStudentSelection(): void {
    const hadSelection = this.selectedProjectId != null;

    this.projectLoad?.unsubscribe();
    this.selectedProjectId = null;
    this.selectedProject = null;
    this.selectedProject$.next(null);
    this.projectLoadFailed = false;
    this.currentTab = this.tabs[0];

    if (hadSelection) {
      this.router.navigate(this.listLink, {
        queryParams: this.portfolioListFilterQueryParams(),
        replaceUrl: true,
      });
    }
  }

  // The unit stream fires again on every unit change, so this has to be idempotent or
  // a switch would stack a second pair of route subscriptions on top of the first.
  private subscribeToRouteParams(): void {
    if (this.routeParamsSubscribed) {
      return;
    }

    this.routeParamsSubscribed = true;
    this.subscriptions.push(
      this.route.paramMap.subscribe((params) => {
        this.updateCurrentTabFromState(params.get('tab'), params.get('projectId'));
      }),
      this.route.queryParamMap.subscribe((params) => {
        this.updatePortfolioListFiltersFromQueryParams(params);
      }),
    );
  }

  // A unit change starts a new load, so the one for the unit we left is dropped
  // instead of finishing late and marking the new list as loaded.
  private loadStudents(refetch = false): void {
    this.studentsLoad?.unsubscribe();
    this.loadingStudents = true;
    this.studentsLoadFailed = false;

    this.studentsLoad = this.projectService.loadStudents(this.unit, false, refetch).subscribe({
      next: () => {
        this.loadingStudents = false;
      },
      error: (error) => {
        this.loadingStudents = false;
        this.studentsLoadFailed = true;
        this.alertService.error(`Could not load the students: ${error}`, 6000);
      },
    });
  }

  private updatePortfolioListFiltersFromQueryParams(params: ParamMap): void {
    // A task opened in the progress tab is its own route, and its url carries none of
    // the list's filters, so the page is built again without them. That is not the
    // tutor clearing the filters, so a student route with none in its url takes the
    // ones they last set. The list's own url always says what the filters are.
    const onStudentRoute = !!this.route.snapshot?.paramMap?.get('projectId');
    const filters =
      onStudentRoute && !FILTER_QUERY_PARAMS.some((key) => params.has(key))
        ? (this.markingState.filtersFor(this.unit.id) ?? this.portfolioListFilters)
        : this.filtersFromQueryParams(params);

    // Compared without the spaces at either end, which the url drops. Otherwise the url
    // coming back would replace what the tutor is typing, and eat the space between a
    // first and last name as soon as it was typed.
    if (!sameFilters(filters, this.portfolioListFilters)) {
      this.portfolioListFilters = filters;
      this.listQueryParams = this.portfolioListFilterQueryParams();
    }

    this.markingState.rememberFilters(this.unit.id, this.portfolioListFilters);
  }

  private filtersFromQueryParams(params: ParamMap): PortfolioListFilters {
    return {
      portfolioFilter: params.get('portfolio') === 'all' ? 'all' : 'submitted_only',
      tutorialFilter: params.get('tutorial') === 'mine' ? 'mine' : 'all',
      gradeFilter: this.gradeFilterFromQueryParam(params.get('grade')),
      filterText: params.get('search') ?? '',
    };
  }

  private gradeFilterFromQueryParam(grade: string | null): number | null {
    if (grade === null) {
      return null;
    }

    const gradeValue = Number(grade);
    return Number.isFinite(gradeValue) ? gradeValue : null;
  }

  private portfolioListFilterQueryParams(): Record<string, string | number | null> {
    return {
      portfolio:
        this.portfolioListFilters.portfolioFilter === DEFAULT_PORTFOLIO_LIST_FILTERS.portfolioFilter
          ? null
          : this.portfolioListFilters.portfolioFilter,
      tutorial:
        this.portfolioListFilters.tutorialFilter === DEFAULT_PORTFOLIO_LIST_FILTERS.tutorialFilter
          ? null
          : this.portfolioListFilters.tutorialFilter,
      grade: this.portfolioListFilters.gradeFilter,
      search: this.portfolioListFilters.filterText.trim() || null,
    };
  }

  private updateCurrentTabFromState(
    tabParam?: string | null,
    projectIdParam?: string | null,
  ): void {
    const projectId = projectIdParam ? Number(projectIdParam) : null;
    const requestedTab = this.tabFromRoute(tabParam, !!projectId);

    // Only an arrival from somewhere else in the app moves focus, never the first load.
    if (!this.routeSeen && this.arrivedWithinApp()) {
      this.focusTarget = requestedTab.routeSegment === 'select' ? 'list' : 'student';
    }
    this.routeSeen = true;

    this.currentTab = requestedTab;

    if (!projectId) {
      this.projectLoad?.unsubscribe();
      this.selectedProjectId = null;
      this.selectedProject = null;
      this.selectedProject$.next(null);
      this.projectLoadFailed = false;
      return;
    }

    this.updateTabLinks(projectId);

    if (this.selectedProject?.id === projectId) {
      return;
    }

    // Already on its way, so a tab change while it loads does not ask for it again.
    if (this.selectedProjectId === projectId && !this.projectLoadFailed) {
      return;
    }

    // A different student: drop the one on screen now, so their name and grade are
    // never shown under the next student's url while it loads.
    if (this.selectedProject) {
      this.selectedProject = null;
      this.selectedProject$.next(null);
    }

    this.loadProject(projectId);
  }

  // The navigation that shows this page is still running when the router builds the page
  // itself, and has already finished when the page waits for its unit to load first, so
  // either one is read. It follows an earlier navigation only when the tutor came from
  // somewhere else in the app; the first load of the app has none before it.
  private arrivedWithinApp(): boolean {
    const navigation =
      this.router.currentNavigation?.() ?? this.router.lastSuccessfulNavigation?.() ?? null;
    return !!navigation?.previousNavigation;
  }

  private tabFromRoute(tabParam: string | null, hasProject: boolean): PortfolioTab {
    if (!hasProject) {
      return this.tabs[0];
    }

    const routeTab = this.tabs.find(
      (tab) => tab.routeSegment === tabParam && tab.routeSegment !== 'select',
    );

    return routeTab ?? this.tabs.find((tab) => tab.routeSegment === 'progress') ?? this.tabs[0];
  }

  private updateTabLinks(projectId: number): void {
    const key = `${this.unit?.id}/${projectId}`;
    if (key === this.tabLinksKey) {
      return;
    }

    this.tabLinksKey = key;
    this.tabLinks = Object.fromEntries(
      this.studentTabs.map((tab) => [
        tab.routeSegment,
        [...this.listLink, projectId, tab.routeSegment],
      ]),
    );
  }

  private loadProject(projectId: number): void {
    this.projectLoad?.unsubscribe();
    this.selectedProjectId = projectId;
    this.projectLoadFailed = false;

    this.projectLoad = this.projectService.loadProject(projectId, this.unit).subscribe({
      next: (project) => {
        if (this.selectedProjectId !== project.id) {
          return;
        }

        this.selectedProject = project;
        this.selectedProject$.next(project);
      },
      error: (error) => {
        if (this.selectedProjectId !== projectId) {
          return;
        }

        this.selectedProject = null;
        this.selectedProject$.next(null);
        this.projectLoadFailed = true;
        this.alertService.error(`Could not load this student: ${error}`, 6000);
      },
    });
  }

  private navigateToProject(projectId: number, tab: PortfolioTabKey): void {
    this.router.navigate([...this.listLink, projectId, tab], {
      queryParams: this.portfolioListFilterQueryParams(),
      replaceUrl: true,
    });
  }
}
