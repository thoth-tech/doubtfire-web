import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {EnvironmentInjector, createEnvironmentInjector} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, ParamMap, Params, Router, convertToParamMap} from '@angular/router';
import {BehaviorSubject, Observable, Subject, config, of, throwError} from 'rxjs';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';
import {ProjectService} from 'src/app/api/services/project.service';
import {UserService} from 'src/app/api/services/user.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {DEFAULT_PORTFOLIO_LIST_FILTERS} from './directives/portfolios-list/portfolios-list.component';
import {PortfoliosComponent} from './portfolios.component';

function unitStub(loadD2lMapping: () => Observable<unknown> = () => of({})): Unit {
  return {id: 1, code: 'SIT101', loadD2lMapping} as unknown as Unit;
}

function projectStub(id: number): Project {
  return {id, student: {name: `Student ${id}`}} as unknown as Project;
}

describe('PortfoliosComponent', () => {
  let component: PortfoliosComponent;
  let params: BehaviorSubject<ParamMap>;
  let queryParams: BehaviorSubject<ParamMap>;
  let loadStudents: ReturnType<typeof vi.fn>;
  let loadProject: ReturnType<typeof vi.fn>;
  let router: {
    navigate: ReturnType<typeof vi.fn>;
    navigateByUrl: ReturnType<typeof vi.fn>;
    navigated: boolean;
    currentNavigation: () => unknown;
    lastSuccessfulNavigation: () => unknown;
  };
  // What the router says about the navigation that is showing the page.
  let runningNavigation: unknown;
  let finishedNavigation: unknown;
  let alerts: {error: ReturnType<typeof vi.fn>};
  let systemRole: string;

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({}));
    queryParams = new BehaviorSubject(convertToParamMap({}));
    loadStudents = vi.fn(() => of([]));
    loadProject = vi.fn((id: number) => of(projectStub(id)));
    runningNavigation = null;
    finishedNavigation = null;
    router = {
      navigate: vi.fn(),
      navigateByUrl: vi.fn(),
      // The page waits for its unit to load, so even on the first load of the app the
      // router has finished navigating by the time the page is built.
      navigated: true,
      currentNavigation: () => runningNavigation,
      lastSuccessfulNavigation: () => finishedNavigation,
    };
    alerts = {error: vi.fn()};
    systemRole = 'Tutor';

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: params,
            queryParamMap: queryParams,
            // The router updates the snapshot before the observables emit.
            get snapshot() {
              return {paramMap: params.value};
            },
            parent: {snapshot: {data: {}}},
          },
        },
        {provide: ProjectService, useValue: {loadStudents, loadProject}},
        {provide: Router, useValue: router},
        {provide: AlertService, useValue: alerts},
        {
          provide: UserService,
          useValue: {
            get currentUser() {
              return {systemRole};
            },
          },
        },
        {provide: GradeService, useValue: {gradeLabel: () => 'Pass'}},
      ],
    });
  });

  afterEach(() => {
    config.onUnhandledError = null;
  });

  // The list, a student and a task are separate routes, so the router builds a new page
  // for each. Every start is a new component on the url the test set, sharing the rest.
  function start(unit: Unit = unitStub()): void {
    const injector = createEnvironmentInjector(
      [PortfoliosComponent],
      TestBed.inject(EnvironmentInjector),
    );
    component = injector.get(PortfoliosComponent);
    component.unit$ = of(unit);
    component.ngOnInit();
  }

  function visit(routeParams: Params, query: Params = {}): void {
    params.next(convertToParamMap(routeParams));
    queryParams.next(convertToParamMap(query));
  }

  // Typing "Ana " put "Ana" in the url, and the url coming back then replaced the
  // text in the box, so the space before the last name could never be typed.
  it('keeps a space typed in the search when the url comes back trimmed', () => {
    start();

    component.portfolioListFiltersChange({...DEFAULT_PORTFOLIO_LIST_FILTERS, filterText: 'Ana '});
    queryParams.next(convertToParamMap({search: 'Ana'}));

    expect(component.portfolioListFilters.filterText).toBe('Ana ');
  });

  // Opening a task in the progress tab moves to a url without the query parameters, and
  // the page built for it started with no filters, so the way back lost them.
  it('keeps the list filters when a task opens in the progress tab', () => {
    visit({projectId: '5', tab: 'progress'}, {grade: '3', search: 'amy'});
    start();
    component.ngOnDestroy();

    visit({projectId: '5', tab: 'progress', taskAbbreviation: '1.1P'});
    start();

    expect(component.portfolioListFilters.gradeFilter).toBe(3);
    expect(component.portfolioListFilters.filterText).toBe('amy');
    expect(component.listQueryParams).toEqual(expect.objectContaining({grade: 3, search: 'amy'}));
  });

  it('takes the filters from the url on the list itself', () => {
    visit({}, {grade: '2'});
    start();
    expect(component.portfolioListFilters.gradeFilter).toBe(2);

    queryParams.next(convertToParamMap({}));
    expect(component.portfolioListFilters.gradeFilter).toBeNull();

    component.ngOnDestroy();
    visit({});
    start();
    expect(component.portfolioListFilters.gradeFilter).toBeNull();
  });

  // A failed load used to send the tutor to the home page.
  it('shows an error on the page when the students cannot be loaded', () => {
    loadStudents.mockReturnValue(throwError(() => 'offline'));
    start();

    expect(component.studentsLoadFailed).toBe(true);
    expect(component.loadingStudents).toBe(false);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  // The first load is served from the cache after it has run once, so asking again the
  // same way after a grades upload showed the old grades.
  it('goes to the server when the students are loaded again', () => {
    const unit = unitStub();
    start(unit);
    expect(loadStudents).toHaveBeenLastCalledWith(unit, false, false);

    component.reloadStudents();

    expect(loadStudents).toHaveBeenLastCalledWith(unit, false, true);
  });

  it('offers to try a student again after their load fails', () => {
    loadProject.mockReturnValueOnce(throwError(() => 'gone'));
    visit({projectId: '5', tab: 'assessment'});
    start();

    expect(component.projectLoadFailed).toBe(true);
    expect(component.selectedProject).toBeNull();

    component.retryProject();

    expect(loadProject).toHaveBeenLastCalledWith(5, expect.anything());
    expect(component.projectLoadFailed).toBe(false);
    expect(component.selectedProject?.id).toBe(5);
  });

  it('asks for a student once while they load, however often the tab changes', () => {
    const pending: Subject<Project> = new Subject();
    loadProject.mockReturnValue(pending);
    start();

    params.next(convertToParamMap({projectId: '5', tab: 'progress'}));
    params.next(convertToParamMap({projectId: '5', tab: 'portfolio'}));

    expect(loadProject).toHaveBeenCalledTimes(1);
    expect(component.currentTab.routeSegment).toBe('portfolio');
  });

  it('drops the student on screen while the next one loads', () => {
    start();
    params.next(convertToParamMap({projectId: '5', tab: 'progress'}));
    expect(component.selectedProject?.id).toBe(5);

    loadProject.mockReturnValue(new Subject<Project>());
    params.next(convertToParamMap({projectId: '6', tab: 'progress'}));

    expect(component.selectedProject).toBeNull();
  });

  it('builds each student tab link once, with the list filters on it', () => {
    start();
    component.portfolioListFiltersChange({...DEFAULT_PORTFOLIO_LIST_FILTERS, gradeFilter: 2});
    params.next(convertToParamMap({projectId: '5', tab: 'progress'}));
    const links = component.tabLinks;

    params.next(convertToParamMap({projectId: '5', tab: 'portfolio'}));

    expect(component.tabLinks).toBe(links);
    expect(links.assessment).toEqual(['/units', 1, 'students', 'portfolios', 5, 'assessment']);
    expect(component.listQueryParams).toEqual(expect.objectContaining({grade: 2}));
  });

  describe('focus on arrival', () => {
    let studentFocus: ReturnType<typeof vi.fn>;
    let listFocus: ReturnType<typeof vi.fn>;

    function startWithHeadings(): void {
      start();
      studentFocus = vi.fn();
      listFocus = vi.fn();
      Object.assign(component, {
        studentHeading: {nativeElement: {focus: studentFocus}},
        portfoliosList: {focusHeading: listFocus},
      });
    }

    // The name button a tutor pressed goes with the list, which leaves focus on the page.
    it('moves focus to the heading of the view the tutor arrived at', () => {
      finishedNavigation = {previousNavigation: {}};
      visit({projectId: '5', tab: 'progress'});
      startWithHeadings();

      component.ngAfterViewChecked();
      component.ngAfterViewChecked();

      expect(studentFocus).toHaveBeenCalledTimes(1);
      expect(studentFocus).toHaveBeenCalledWith({preventScroll: true});

      component.ngOnDestroy();
      visit({});
      startWithHeadings();
      component.ngAfterViewChecked();

      expect(listFocus).toHaveBeenCalledTimes(1);
    });

    it('also reads a navigation that is still running when the page is built', () => {
      runningNavigation = {previousNavigation: {}};
      visit({projectId: '5', tab: 'progress'});
      startWithHeadings();

      component.ngAfterViewChecked();

      expect(studentFocus).toHaveBeenCalledTimes(1);
    });

    // The page waits for its unit, so it is built after the first navigation has
    // finished. That navigation has nothing before it.
    it('leaves focus alone on the first load of the app', () => {
      finishedNavigation = {previousNavigation: null};
      visit({projectId: '5', tab: 'progress'});
      startWithHeadings();

      component.ngAfterViewChecked();

      expect(studentFocus).not.toHaveBeenCalled();
    });

    it('leaves focus alone when it is still on something', () => {
      const button = document.createElement('button');
      document.body.appendChild(button);
      button.focus();
      finishedNavigation = {previousNavigation: {}};
      visit({projectId: '5', tab: 'progress'});
      startWithHeadings();

      component.ngAfterViewChecked();

      expect(studentFocus).not.toHaveBeenCalled();
      button.remove();
    });
  });

  // A unit with no D2L link answers the mapping request with an error, which nothing
  // handled, so it surfaced as an uncaught error on every visit by a convenor.
  it('keeps a missing D2L link out of the console', async () => {
    const unhandled = vi.fn();
    config.onUnhandledError = unhandled;
    systemRole = 'Convenor';

    start(unitStub(() => throwError(() => new Error('404'))));
    await new Promise((resolve) => setTimeout(resolve));

    expect(unhandled).not.toHaveBeenCalled();
  });
});
