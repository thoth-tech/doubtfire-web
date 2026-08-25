import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatMenuModule} from '@angular/material/menu';
import {ActivatedRoute, Router} from '@angular/router';
import {BehaviorSubject, of, throwError} from 'rxjs';
import {Project} from '../api/models/project';
import {Task} from '../api/models/task';
import {TaskStatusEnum} from '../api/models/task-status';
import {ProjectService} from '../api/services/project.service';
import {GlobalStateService} from '../projects/states/index/global-state.service';
import {CrossDashboardComponent} from './f-cross-dashboard.component';

describe('CrossDashboardComponent', () => {
  let component: CrossDashboardComponent;
  let fixture: ComponentFixture<CrossDashboardComponent>;
  let projectsSubject: BehaviorSubject<Project[]>;
  let projectServiceQuery: ReturnType<typeof vi.fn>;

  const syncView = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const makeTask = (
    name: string,
    abbreviation: string,
    status: TaskStatusEnum,
    dueDate: Date,
    topWeight: number = 0,
  ): Task =>
    ({
      status,
      topWeight,
      numNewComments: 0,
      definition: {
        name,
        abbreviation,
        targetGradeText: 'Pass',
        description: `${name} description`,
        targetDate: dueDate,
      },
    }) as unknown as Task;

  const makeProject = (id: number, code: string, isActive: boolean, tasks: Task[] = []): Project =>
    ({
      id,
      tasks,
      unit: {
        code,
        name: `${code} Unit`,
        isActive,
        taskDefinitions: [],
      },
      calcTopTasks: vi.fn(),
      activeTasks: vi.fn().mockReturnValue(tasks),
    }) as unknown as Project;

  beforeEach(async () => {
    projectsSubject = new BehaviorSubject<Project[]>([]);
    projectServiceQuery = vi.fn().mockReturnValue(of([]));

    const globalStateServiceStub = {
      onLoad: (callback: () => void): void => callback(),
      currentUserProjects: {
        values: projectsSubject.asObservable(),
      },
    };

    const projectServiceStub = {
      query: projectServiceQuery,
    };

    const activatedRouteStub = {
      snapshot: {
        queryParamMap: {
          get: vi.fn().mockReturnValue(null),
        },
      },
    };

    const routerStub = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      declarations: [CrossDashboardComponent],
      imports: [MatMenuModule],
      providers: [
        {
          provide: GlobalStateService,
          useValue: globalStateServiceStub,
        },
        {
          provide: ProjectService,
          useValue: projectServiceStub,
        },
        {
          provide: ActivatedRoute,
          useValue: activatedRouteStub,
        },
        {
          provide: Router,
          useValue: routerStub,
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CrossDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    projectsSubject.complete();
  });

  it('uses Active units as the default scope', () => {
    expect(component.unitScope).toBe('active');
    expect(projectServiceQuery).not.toHaveBeenCalled();
  });
  it('restores the unit scope from the URL', () => {
    const route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: {
        queryParamMap: {
          get: ReturnType<typeof vi.fn>;
        };
      };
    };

    route.snapshot.queryParamMap.get.mockReturnValue('previous');

    const newFixture = TestBed.createComponent(CrossDashboardComponent);
    const newComponent = newFixture.componentInstance;

    newFixture.detectChanges();

    expect(newComponent.unitScope).toBe('previous');

    newFixture.destroy();
  });

  it('falls back to Active units when the URL scope is invalid', () => {
    const route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: {
        queryParamMap: {
          get: ReturnType<typeof vi.fn>;
        };
      };
    };

    route.snapshot.queryParamMap.get.mockReturnValue('invalid');

    const newFixture = TestBed.createComponent(CrossDashboardComponent);
    newFixture.detectChanges();

    expect(newFixture.componentInstance.unitScope).toBe('active');

    newFixture.destroy();
  });

  it('falls back to Active units when the URL scope is missing', () => {
    const route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: {
        queryParamMap: {
          get: ReturnType<typeof vi.fn>;
        };
      };
    };

    route.snapshot.queryParamMap.get.mockReturnValue(null);

    const newFixture = TestBed.createComponent(CrossDashboardComponent);
    newFixture.detectChanges();

    expect(newFixture.componentInstance.unitScope).toBe('active');

    newFixture.destroy();
  });

  it('updates the URL when the unit scope changes', () => {
    component.setUnitScope('previous');

    const router = TestBed.inject(Router) as unknown as {
      navigate: ReturnType<typeof vi.fn>;
    };

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: {scope: 'previous'},
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('keeps only active projects in the active-unit collection', () => {
    projectsSubject.next([makeProject(1, 'COS10001', true), makeProject(2, 'COS30046', false)]);
    expect(component.activeUnits.map((unit) => unit.code)).toEqual(['COS10001']);
    expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['COS10001']);
  });

  it('loads and displays previous units in Previous units mode', () => {
    projectServiceQuery.mockReturnValue(
      of([makeProject(1, 'COS10001', true), makeProject(2, 'COS30046', false)]),
    );

    component.setUnitScope('previous');

    expect(projectServiceQuery).toHaveBeenCalledTimes(1);
    expect(component.previousUnitsLoaded).toBe(true);
    expect(component.loadingPreviousUnits).toBe(false);
    expect(component.previousUnits.map((unit) => unit.code)).toEqual(['COS30046']);
    expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['COS30046']);
    expect(component.previousUnits[0].isPrevious).toBe(true);
  });

  it('shows active units first and previous units afterward in All units mode', () => {
    projectsSubject.next([makeProject(1, 'COS10001', true), makeProject(2, 'COS20007', true)]);

    projectServiceQuery.mockReturnValue(
      of([
        makeProject(1, 'COS10001', true),
        makeProject(2, 'COS20007', true),
        makeProject(3, 'COS30046', false),
      ]),
    );

    component.setUnitScope('all');

    expect(component.displayedUnits.map((unit) => unit.code)).toEqual([
      'COS10001',
      'COS20007',
      'COS30046',
    ]);
  });

  it('does not request previous units again after they have loaded', () => {
    projectServiceQuery.mockReturnValue(of([makeProject(3, 'COS30046', false)]));

    component.setUnitScope('previous');
    component.setUnitScope('active');
    component.setUnitScope('all');

    expect(projectServiceQuery).toHaveBeenCalledTimes(1);
  });

  it('renders the no-previous-units empty state', () => {
    projectServiceQuery.mockReturnValue(of([]));

    component.setUnitScope('previous');
    fixture.detectChanges();

    expect(component.previousUnitsLoaded).toBe(true);
    expect(component.loadingPreviousUnits).toBe(false);
    expect(component.previousUnits).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Previous units');
    expect(fixture.nativeElement.textContent).toContain('No previous units are available.');
  });

  it('shows an error state when previous units cannot be loaded', () => {
    projectServiceQuery.mockReturnValue(
      throwError(() => new Error('Unable to load previous units')),
    );

    component.setUnitScope('previous');
    fixture.detectChanges();

    expect(component.previousUnitsLoadError).toBe(true);
    expect(component.loadingPreviousUnits).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Previous units could not be loaded.');
  });

  it('filters only the selected unit and ignores case and outer whitespace', async () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Individual Retrospective', '5.1P', 'not_started', new Date(2026, 7, 12)),
        makeTask('Leadership Report', '5.3D', 'not_started', new Date(2026, 7, 18)),
      ]),
      makeProject(2, 'SIT782', true, [
        makeTask('Security Report', '2.1P', 'not_started', new Date(2026, 7, 15)),
      ]),
    ]);

    await syncView();

    expect(component.displayedUnits).toHaveLength(2);

    const searchInputs = fixture.nativeElement.querySelectorAll(
      'input[type="search"]',
    ) as NodeListOf<HTMLInputElement>;

    expect(searchInputs).toHaveLength(2);

    searchInputs[0].value = '  RETROSPECTIVE  ';
    searchInputs[0].dispatchEvent(new Event('input', {bubbles: true}));

    await syncView();

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['5.1P']);

    expect(component.displayedUnits[1].tasks.map((task) => task.abbreviation)).toEqual(['2.1P']);
  });

  it('matches abbreviation, status, unit code and displayed due date', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Individual Retrospective', '5.1P', 'ready_for_feedback', new Date(2026, 7, 12)),
      ]),
    ]);

    const matchingQueries = [
      '5.1p',
      'Awaiting Feedback',
      'sit764',
      'Wednesday 12 August',
      '12/08/2026',
      '2026-08-12',
    ];

    for (const query of matchingQueries) {
      component.setSearch(1, query);

      expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['5.1P']);
    }
  });

  it('clears the search and restores the original task list', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Individual Retrospective', '5.1P', 'not_started', new Date(2026, 7, 12)),
        makeTask('Leadership Report', '5.3D', 'not_started', new Date(2026, 7, 18)),
      ]),
    ]);

    component.setSearch(1, 'does not exist');

    expect(component.displayedUnits[0].tasks).toEqual([]);

    component.setSearch(1, '   ');

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      '5.1P',
      '5.3D',
    ]);
  });

  it('combines search with the Hide Completed filter', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Completed Task', '1.1P', 'complete', new Date(2026, 7, 10)),
        makeTask('Open Task', '1.2P', 'not_started', new Date(2026, 7, 12)),
      ]),
    ]);

    component.setSearch(1, 'task');
    component.toggleFilter(1, component.filterOptions[0]);

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['1.2P']);

    component.setSearch(1, '');

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['1.2P']);
  });

  it('preserves Due Date sorting after search is applied', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Later Task', 'LATE', 'not_started', new Date(2026, 7, 20)),
        makeTask('Earlier Task', 'EARLY', 'not_started', new Date(2026, 7, 10)),
      ]),
    ]);

    const dueDateSort = component.sortOptions.find((mode) => mode === 'Due Date');

    if (!dueDateSort) {
      throw new Error('Due Date sort option is missing');
    }

    component.setSort(1, dueDateSort);
    component.setSearch(1, 'task');

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'EARLY',
      'LATE',
    ]);
  });

  it('applies separate search state in All and Previous unit scopes', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Current Task', 'CUR', 'not_started', new Date(2026, 7, 12)),
      ]),
    ]);

    projectServiceQuery.mockReturnValue(
      of([
        makeProject(2, 'SIT704', false, [
          makeTask('Archived Security Task', 'OLD1', 'complete', new Date(2025, 7, 12)),
          makeTask('Archived Project Task', 'OLD2', 'complete', new Date(2025, 7, 15)),
        ]),
      ]),
    );

    component.setUnitScope('all');
    component.setSearch(2, 'security');

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['CUR']);

    expect(component.displayedUnits[1].tasks.map((task) => task.abbreviation)).toEqual(['OLD1']);

    component.setUnitScope('previous');

    expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['SIT704']);
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['OLD1']);
  });

  it('shows a no-results message without hiding the unit', async () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Individual Retrospective', '5.1P', 'not_started', new Date(2026, 7, 12)),
      ]),
    ]);

    await syncView();

    expect(fixture.nativeElement.textContent).toContain('SIT764');
    expect(fixture.nativeElement.querySelectorAll('f-dashboard-list-item')).toHaveLength(1);

    component.setSearch(1, 'not a matching task');

    await syncView();

    expect(component.displayedUnits[0].tasks).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('SIT764');
    expect(fixture.nativeElement.textContent).toContain(
      'No tasks match the current search and filters.',
    );
    expect(fixture.nativeElement.querySelectorAll('f-dashboard-list-item')).toHaveLength(0);

    component.setSearch(1, '');

    await syncView();

    expect(component.displayedUnits[0].tasks).toHaveLength(1);
    expect(component.displayedUnits[0].tasks[0].title).toBe('Individual Retrospective');
    expect(fixture.nativeElement.querySelectorAll('f-dashboard-list-item')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toContain(
      'No tasks match the current search and filters.',
    );
  });
});
