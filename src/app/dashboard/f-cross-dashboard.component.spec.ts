import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatButtonHarness} from '@angular/material/button/testing';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatMenuModule} from '@angular/material/menu';
import {MatSelectModule} from '@angular/material/select';
import {MatSelectHarness} from '@angular/material/select/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {BehaviorSubject, Observable, ReplaySubject, Subject, of, throwError} from 'rxjs';
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
import {GlobalStateService} from '../projects/states/index/global-state.service';
import {CrossDashboardComponent} from './f-cross-dashboard.component';

describe('CrossDashboardComponent', () => {
  let component: CrossDashboardComponent;
  let fixture: ComponentFixture<CrossDashboardComponent>;
  let projectsSubject: BehaviorSubject<Project[]>;
  let projectServiceQuery: ReturnType<typeof vi.fn>;
  let recommendationsSubject: ReplaySubject<TaskRecommendation[]>;
  let recommendationServiceGetAll: ReturnType<typeof vi.fn>;
  let taskStatusSubject: Subject<Task>;
  let nextTaskDefinitionId: number;

  const syncView = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const makeDate = (day: number, hour = 12): Date => new Date(2026, 7, day, hour, 0, 0);

  const makeTask = (
    name: string,
    abbreviation: string,
    status: TaskStatusEnum,
    dueDate: Date | null | undefined,
    topWeight: number = 0,
    targetGrade: number = 0,
    targetGradeText: string = Grade.GRADES[targetGrade],
  ): Task =>
    ({
      status,
      topWeight,
      numNewComments: 0,
      localDueDate: vi.fn().mockReturnValue(dueDate),
      inSubmittedState: vi.fn().mockReturnValue(TaskStatus.SUBMITTED_STATUSES.includes(status)),
      definition: {
        id: nextTaskDefinitionId++,
        name,
        abbreviation,
        targetGrade,
        targetGradeText,
        description: `${name} description`,
        targetDate: dueDate,
      },
    }) as unknown as Task;

  const makeProject = (
    id: number,
    code: string,
    isActive: boolean,
    tasks: Task[] = [],
    name: string = `${code} Unit`,
  ): Project => {
    const project = {
      id,
      tasks,
      unit: {
        code,
        name,
        isActive,
        taskDefinitions: [],
      },
      calcTopTasks: vi.fn(),
      activeTasks: vi.fn().mockReturnValue(tasks),
    } as unknown as Project;

    tasks.forEach((task) => (task.project = project));
    return project;
  };

  beforeEach(async () => {
    projectsSubject = new BehaviorSubject<Project[]>([]);
    projectServiceQuery = vi.fn().mockReturnValue(of([]));
    recommendationsSubject = new ReplaySubject<TaskRecommendation[]>(1);
    recommendationsSubject.next([]);
    recommendationServiceGetAll = vi.fn().mockReturnValue(recommendationsSubject.asObservable());
    taskStatusSubject = new Subject<Task>();
    nextTaskDefinitionId = 100;

    const globalStateServiceStub = {
      onLoad: (callback: () => void): void => callback(),
      currentUserProjects: {
        values: projectsSubject.asObservable(),
        get currentValues(): Project[] {
          return projectsSubject.value;
        },
      },
    };

    const projectServiceStub = {
      query: projectServiceQuery,
    };

    await TestBed.configureTestingModule({
      declarations: [CrossDashboardComponent],
      imports: [
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatMenuModule,
        MatSelectModule,
        NoopAnimationsModule,
      ],
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
          provide: TaskRecommendationService,
          useValue: {getAll: recommendationServiceGetAll},
        },
        {
          provide: TaskService,
          useValue: {taskStatusUpdated$: taskStatusSubject.asObservable()},
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
    recommendationsSubject.complete();
    taskStatusSubject.complete();
  });

  const recommendationFor = (task: Task, projectId: number, score: number): TaskRecommendation => ({
    task_id: null,
    task_definition_id: task.definition.id,
    task_name: task.definition.name,
    project_id: projectId,
    unit_id: 20,
    priority_score: score,
  });

  it('uses Active units as the default scope', () => {
    expect(component.unitScope).toBe('active');
    expect(projectServiceQuery).not.toHaveBeenCalled();
  });

  it('keeps only active projects in the active-unit collection', () => {
    projectsSubject.next([makeProject(1, 'COS10001', true), makeProject(2, 'COS30046', false)]);

    expect(component.activeUnits.map((unit) => unit.code)).toEqual(['COS10001']);
    expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['COS10001']);
  });

  it('includes authorised tasks above the project target grade', () => {
    const passTask = makeTask('Pass Task', 'P1', 'complete', makeDate(10), 0, 0);
    const distinctionTask = makeTask('Distinction Task', 'D1', 'redo', makeDate(11), 0, 2);
    const project = makeProject(1, 'COS20007', true, [passTask, distinctionTask]);
    const targetGradeTasks = vi.fn().mockReturnValue([passTask]);

    project.targetGrade = 0;
    project.activeTasks = targetGradeTasks;
    projectsSubject.next([project]);

    expect(targetGradeTasks).not.toHaveBeenCalled();
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'D1',
      'P1',
    ]);
  });

  it('maps each task using its effective due date and submitted state', () => {
    const targetDate = makeDate(30);
    const effectiveDate = makeDate(23);
    const activeTask = makeTask('Active task', '1.1P', 'working_on_it', targetDate);
    const submittedTask = makeTask('Submitted task', '1.2P', 'ready_for_feedback', targetDate);

    vi.mocked(activeTask.localDueDate).mockReturnValue(effectiveDate);
    projectsSubject.next([makeProject(1, 'COS10001', true, [activeTask, submittedTask])]);

    expect(component.activeUnits[0].tasks[0]).toMatchObject({
      dueDate: effectiveDate,
      showDueWarning: true,
    });
    expect(component.activeUnits[0].tasks[1].showDueWarning).toBe(false);
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
      'input[aria-label^="Search tasks in"]',
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

  it('renders per-unit search with an explicit readable surface and placeholder', async () => {
    projectsSubject.next([makeProject(1, 'SIT764', true)]);

    await syncView();

    const searchInput = fixture.nativeElement.querySelector(
      'input[aria-label="Search tasks in SIT764"]',
    ) as HTMLInputElement;

    expect(searchInput.classList.contains('bg-white')).toBe(true);
    expect(searchInput.classList.contains('text-gray-900')).toBe(true);
    expect(searchInput.classList.contains('placeholder:text-gray-600')).toBe(true);
    expect(searchInput.classList.contains('placeholder:opacity-100')).toBe(true);
  });

  it('does not confuse Australian dates that contain the same numbers in another order', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('December Task', 'DEC', 'not_started', new Date(2026, 11, 8)),
      ]),
    ]);

    component.setSearch(1, '12/08/2026');
    expect(component.displayedUnits[0].tasks).toEqual([]);

    component.setSearch(1, '08/12/2026');
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['DEC']);
  });

  it('matches subtitle and description text shown on the task card', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Individual Retrospective', '5.1P', 'not_started', new Date(2026, 7, 12)),
      ]),
    ]);

    component.setSearch(1, 'Pass');
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['5.1P']);

    component.setSearch(1, 'description');
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['5.1P']);

    component.setSearch(1, 'not shown anywhere');
    expect(component.displayedUnits[0].tasks).toEqual([]);
  });

  it('keeps punctuation-only input visible without filtering tasks', async () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Individual Retrospective', '5.1P', 'not_started', new Date(2026, 7, 12)),
        makeTask('Leadership Report', '5.3D', 'not_started', new Date(2026, 7, 18)),
      ]),
    ]);

    await syncView();

    const searchInput = fixture.nativeElement.querySelector(
      'input[aria-label^="Search tasks in"]',
    ) as HTMLInputElement;

    searchInput.value = 'retro';
    searchInput.dispatchEvent(new Event('input', {bubbles: true}));
    await syncView();

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['5.1P']);

    searchInput.value = '-';
    searchInput.dispatchEvent(new Event('input', {bubbles: true}));
    await syncView();

    expect(component.getSearchTerm(1)).toBe('-');
    expect(component.hasSearchTerm(1)).toBe(false);
    expect(searchInput.value).toBe('-');
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      '5.1P',
      '5.3D',
    ]);
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
        makeTask('Completed Security Review', '1.1P', 'complete', new Date(2026, 7, 10)),
        makeTask('Open Security Review', '1.2P', 'not_started', new Date(2026, 7, 12)),
        makeTask('Open Calendar Review', '1.3P', 'not_started', new Date(2026, 7, 14)),
      ]),
    ]);

    component.setSearch(1, 'security');
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      '1.2P',
      '1.1P',
    ]);

    component.toggleFilter(1, component.filterOptions[0]);
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['1.2P']);

    component.setSearch(1, '');
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      '1.2P',
      '1.3P',
    ]);
  });

  it('preserves Due Date sorting after search is applied', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Later Security Review', 'LATE', 'not_started', new Date(2026, 7, 20)),
        makeTask('Calendar Setup', 'OTHER', 'not_started', new Date(2026, 7, 5)),
        makeTask('Earlier Security Review', 'EARLY', 'not_started', new Date(2026, 7, 10)),
      ]),
    ]);

    const dueDateSort = component.sortOptions.find((mode) => mode === 'Due Date');

    if (!dueDateSort) {
      throw new Error('Due Date sort option is missing');
    }

    component.setSort(1, dueDateSort);
    component.setSearch(1, 'security');

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'EARLY',
      'LATE',
    ]);
  });

  it('sorts recommendations by project and task-definition id, including virtual tasks', () => {
    const lowerPriority = makeTask('Lower priority', 'LOW', 'not_started', makeDate(10), 1);
    const recommended = makeTask('Recommended next', 'NEXT', 'not_started', makeDate(20), 4);
    const project = makeProject(7, 'DEMO20007', true, [lowerPriority, recommended]);

    projectsSubject.next([project]);
    recommendationsSubject.next([recommendationFor(recommended, project.id, 95)]);

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'NEXT',
      'LOW',
    ]);
  });

  it('refreshes recommendations after a status change in an active project', async () => {
    const task = makeTask('Current task', 'CURRENT', 'working_on_it', makeDate(10));
    const project = makeProject(7, 'DEMO20007', true, [task]);

    projectsSubject.next([project]);
    const callsBeforeStatusChange = recommendationServiceGetAll.mock.calls.length;
    taskStatusSubject.next(task);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(recommendationServiceGetAll).toHaveBeenCalledTimes(callsBeforeStatusChange + 1);
  });

  it('refreshes recommendation scores whenever the active project cache changes', () => {
    const callsBeforeProjectChanges = recommendationServiceGetAll.mock.calls.length;

    projectsSubject.next([makeProject(1, 'COS10001', true)]);
    projectsSubject.next([makeProject(1, 'COS10001', true), makeProject(2, 'COS30046', true)]);

    expect(recommendationServiceGetAll).toHaveBeenCalledTimes(callsBeforeProjectChanges + 2);
  });

  it('does not refresh recommendations for task changes in an inactive project', async () => {
    const task = makeTask('Previous task', 'PREVIOUS', 'working_on_it', makeDate(10));
    const project = makeProject(8, 'COS30046', false, [task]);

    projectsSubject.next([project]);
    const callsBeforeStatusChange = recommendationServiceGetAll.mock.calls.length;
    taskStatusSubject.next(task);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(recommendationServiceGetAll).toHaveBeenCalledTimes(callsBeforeStatusChange);
  });

  it('cancels a recommendation request superseded by a newer project snapshot', () => {
    const cancelled = vi.fn();
    const pendingRequest: Observable<TaskRecommendation[]> = new Observable(() => cancelled);

    recommendationServiceGetAll.mockImplementationOnce(() => pendingRequest);
    recommendationServiceGetAll.mockImplementation(() => of([]));

    projectsSubject.next([makeProject(1, 'COS10001', true)]);
    expect(cancelled).not.toHaveBeenCalled();

    projectsSubject.next([makeProject(1, 'COS10001', true), makeProject(2, 'COS20007', true)]);

    expect(cancelled).toHaveBeenCalledOnce();
  });

  it('retries after a recommendation error on the next active task status change', async () => {
    const lowerPriority = makeTask('Lower priority', 'LOW', 'working_on_it', makeDate(10), 0);
    const higherPriority = makeTask('Higher priority', 'HIGH', 'working_on_it', makeDate(20), 5);
    const project = makeProject(1, 'COS10001', true, [lowerPriority, higherPriority]);

    recommendationServiceGetAll.mockImplementationOnce(() =>
      throwError(() => new Error('Recommendations unavailable')),
    );
    recommendationServiceGetAll.mockImplementation(() =>
      of([
        recommendationFor(lowerPriority, project.id, 25),
        recommendationFor(higherPriority, project.id, 90),
      ]),
    );

    projectsSubject.next([project]);
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'LOW',
      'HIGH',
    ]);

    taskStatusSubject.next(lowerPriority);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'HIGH',
      'LOW',
    ]);
  });

  it('stops project and task-status refreshes after destruction', async () => {
    const task = makeTask('Current task', 'CURRENT', 'working_on_it', makeDate(10));
    const project = makeProject(1, 'COS10001', true, [task]);

    projectsSubject.next([project]);
    const callsBeforeDestruction = recommendationServiceGetAll.mock.calls.length;
    fixture.destroy();

    projectsSubject.next([project, makeProject(2, 'COS20007', true)]);
    taskStatusSubject.next(task);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(recommendationServiceGetAll).toHaveBeenCalledTimes(callsBeforeDestruction);
  });

  it('keeps final-state tasks below open tasks in every sort mode', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Completed First', 'DONE-FIRST', 'complete', makeDate(3), 0),
        makeTask('Open Later', 'OPEN-LATE', 'not_started', makeDate(20), 4),
        makeTask('Final Later', 'DONE-LATE', 'fail', makeDate(25), 5),
        makeTask('Open Earlier', 'OPEN-EARLY', 'working_on_it', makeDate(10), 1),
      ]),
    ]);

    const expectedByMode: Record<string, string[]> = {
      Recommended: ['OPEN-EARLY', 'OPEN-LATE', 'DONE-FIRST', 'DONE-LATE'],
      'Due Date': ['OPEN-EARLY', 'OPEN-LATE', 'DONE-FIRST', 'DONE-LATE'],
      Default: ['OPEN-EARLY', 'OPEN-LATE', 'DONE-FIRST', 'DONE-LATE'],
    };

    component.sortOptions.forEach((mode) => {
      component.setSort(1, mode);

      expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(
        expectedByMode[mode],
      );
    });
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

  it('includes tasks exactly on the start and end boundaries', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Before Task', 'BEFORE', 'not_started', makeDate(9)),
        makeTask('Start Task', 'START', 'not_started', makeDate(10, 23)),
        makeTask('End Task', 'END', 'not_started', makeDate(20, 1)),
        makeTask('After Task', 'AFTER', 'not_started', makeDate(21)),
      ]),
    ]);

    component.setStartDate('2026-08-10');
    component.setEndDate('2026-08-20');

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'START',
      'END',
    ]);
  });

  it('supports start-date-only filtering', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Before Task', 'BEFORE', 'not_started', makeDate(9)),
        makeTask('Boundary Task', 'BOUNDARY', 'not_started', makeDate(10)),
        makeTask('After Task', 'AFTER', 'not_started', makeDate(11)),
      ]),
    ]);

    component.setStartDate('2026-08-10');

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'BOUNDARY',
      'AFTER',
    ]);
  });

  it('supports end-date-only filtering', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Before Task', 'BEFORE', 'not_started', makeDate(9)),
        makeTask('Boundary Task', 'BOUNDARY', 'not_started', makeDate(10)),
        makeTask('After Task', 'AFTER', 'not_started', makeDate(11)),
      ]),
    ]);

    component.setEndDate('2026-08-10');

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'BEFORE',
      'BOUNDARY',
    ]);
  });

  it('detects a reversed date range and does not apply it', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('First Task', 'TASK1', 'not_started', makeDate(10)),
        makeTask('Second Task', 'TASK2', 'not_started', makeDate(20)),
      ]),
    ]);

    component.setStartDate('2026-08-20');
    component.setEndDate('2026-08-10');

    expect(component.startDate).toBe('2026-08-20');
    expect(component.endDate).toBe('2026-08-10');
    expect(component.isDateRangeInvalid).toBe(true);
    expect(component.isDateFilterActive).toBe(false);
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'TASK1',
      'TASK2',
    ]);
  });

  it('keeps undated tasks without a filter and excludes them while filtering', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Valid Task', 'VALID', 'not_started', makeDate(15)),
        makeTask('Missing Date Task', 'MISSING', 'not_started', undefined),
        makeTask('Invalid Date Task', 'INVALID', 'not_started', new Date('invalid')),
      ]),
    ]);

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'VALID',
      'MISSING',
      'INVALID',
    ]);

    component.setStartDate('2026-08-10');

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['VALID']);
  });

  it('clears both dates and restores the unfiltered task list', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Early Task', 'EARLY', 'not_started', makeDate(5)),
        makeTask('Late Task', 'LATE', 'not_started', makeDate(20)),
      ]),
    ]);

    component.setStartDate('2026-08-10');
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['LATE']);

    component.clearDateRange();

    expect(component.startDate).toBe('');
    expect(component.endDate).toBe('');
    expect(component.isDateFilterActive).toBe(false);
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'EARLY',
      'LATE',
    ]);
  });

  it('keeps a unit visible when no tasks match the selected date range', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [makeTask('Early Task', 'TASK1', 'not_started', makeDate(5))]),
    ]);

    component.setStartDate('2026-08-20');

    expect(component.isDateFilterActive).toBe(true);
    expect(component.displayedUnits).toHaveLength(1);
    expect(component.displayedUnits[0].code).toBe('SIT764');
    expect(component.displayedUnits[0].tasks).toHaveLength(0);
  });

  it('combines date filtering with Hide Completed and Due Date sorting', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Later Review', 'LATER', 'not_started', makeDate(18), 3),
        makeTask('Completed Review', 'COMPLETE', 'complete', makeDate(12), 1),
        makeTask('Earlier Review', 'EARLIER', 'not_started', makeDate(15), 2),
        makeTask('Outside Review', 'OUTSIDE', 'not_started', makeDate(25), 4),
      ]),
    ]);

    component.setStartDate('2026-08-10');
    component.setEndDate('2026-08-20');

    const hideCompleted = component.filterOptions.find((mode) => mode === 'Hide Completed');
    if (!hideCompleted) {
      throw new Error('Hide Completed filter option is missing');
    }
    component.toggleFilter(1, hideCompleted);

    const dueDateSort = component.sortOptions.find((mode) => mode === 'Due Date');
    if (!dueDateSort) {
      throw new Error('Due Date sort option is missing');
    }
    component.setSort(1, dueDateSort);

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'EARLIER',
      'LATER',
    ]);
  });

  it('applies the same date range in Active, Previous and All unit views', () => {
    const activeProject = makeProject(1, 'SIT764', true, [
      makeTask('Active Early Task', 'ACTIVE-EARLY', 'not_started', makeDate(10)),
    ]);
    const previousProject = makeProject(2, 'SIT704', false, [
      makeTask('Previous Late Task', 'PREVIOUS-LATE', 'not_started', makeDate(20)),
    ]);

    projectsSubject.next([activeProject]);
    projectServiceQuery.mockReturnValue(of([activeProject, previousProject]));

    component.setStartDate('2026-08-15');
    expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['SIT764']);
    expect(component.displayedUnits[0].tasks).toHaveLength(0);

    component.setUnitScope('previous');
    expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['SIT704']);
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'PREVIOUS-LATE',
    ]);

    component.setUnitScope('all');
    expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['SIT764', 'SIT704']);
    expect(component.displayedUnits[0].tasks).toHaveLength(0);
    expect(component.displayedUnits[1].tasks.map((task) => task.abbreviation)).toEqual([
      'PREVIOUS-LATE',
    ]);
  });

  it('combines per-unit search with dashboard date filtering', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Early Security Review', 'EARLY', 'not_started', makeDate(8)),
        makeTask('In-range Security Review', 'MATCH', 'not_started', makeDate(15)),
        makeTask('In-range Calendar Setup', 'OTHER', 'not_started', makeDate(16)),
      ]),
    ]);

    component.setSearch(1, 'security');
    component.setStartDate('2026-08-10');
    component.setEndDate('2026-08-20');

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['MATCH']);
  });

  it('renders one labelled global toolbar with canonical status and grade choices', async () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Individual Retrospective', '5.1P', 'not_started', makeDate(12)),
      ]),
    ]);

    await syncView();

    expect(
      fixture.nativeElement.querySelectorAll('[aria-label="Global dashboard filters"]'),
    ).toHaveLength(1);
    expect(
      fixture.nativeElement.querySelectorAll('input[aria-label="Global search"]'),
    ).toHaveLength(1);
    expect(
      fixture.nativeElement.querySelectorAll('input[aria-label^="Search tasks in"]'),
    ).toHaveLength(1);

    expect(component.statusOptions).toEqual(
      TaskStatus.STATUS_KEYS.map((value) => ({
        value,
        label: TaskStatus.STATUS_LABELS.get(value),
      })),
    );
    expect(component.statusOptions).toEqual(
      expect.arrayContaining([
        {value: 'complete', label: 'Complete'},
        {value: 'not_started', label: 'Not Started'},
        {value: 'redo', label: 'Redo'},
        {value: 'fix_and_resubmit', label: 'Resubmit'},
      ]),
    );
    expect(component.gradeOptions).toEqual([
      {value: 0, label: 'Pass'},
      {value: 1, label: 'Credit'},
      {value: 2, label: 'Distinction'},
      {value: 3, label: 'High Distinction'},
    ]);
  });

  it('binds both multiple-select controls and Clear all through the rendered toolbar', async () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Security Pass Task', 'P1', 'complete', makeDate(10), 0, 0),
        makeTask('Security Distinction Task', 'D1', 'redo', makeDate(11), 0, 2),
      ]),
    ]);
    await syncView();

    const mobileFilterToggle = fixture.nativeElement.querySelector(
      'button[data-mobile-global-filter-toggle]',
    ) as HTMLButtonElement;
    mobileFilterToggle.click();
    await syncView();

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const statusSelect = await loader.getHarness(
      MatSelectHarness.with({selector: '[aria-label="Task statuses"]'}),
    );
    const gradeSelect = await loader.getHarness(
      MatSelectHarness.with({selector: '[aria-label="Target grades"]'}),
    );

    expect(await statusSelect.isMultiple()).toBe(true);
    expect(await gradeSelect.isMultiple()).toBe(true);

    await statusSelect.open();
    await statusSelect.clickOptions({text: /^(Redo|Complete)$/});
    await statusSelect.close();

    await gradeSelect.open();
    await gradeSelect.clickOptions({text: /^(Pass|Distinction)$/});
    await gradeSelect.close();

    const globalSearch = fixture.nativeElement.querySelector(
      'input[aria-label="Global search"]',
    ) as HTMLInputElement;
    globalSearch.value = 'security';
    globalSearch.dispatchEvent(new Event('input', {bubbles: true}));
    component.setStartDate('2026-08-01');
    await syncView();

    expect(component.selectedStatuses.slice().sort()).toEqual(['complete', 'redo']);
    expect(component.selectedGrades).toEqual([0, 2]);
    expect(component.mobileSecondaryFilterCount).toBe(5);
    expect(await statusSelect.getValueText()).toContain('Redo');
    expect(await statusSelect.getValueText()).toContain('Complete');
    expect(await gradeSelect.getValueText()).toContain('Pass');
    expect(await gradeSelect.getValueText()).toContain('Distinction');

    const clearAll = await loader.getHarness(MatButtonHarness.with({text: 'Clear all'}));
    expect(await clearAll.isDisabled()).toBe(false);
    await clearAll.click();
    await syncView();

    expect(component.globalSearchTerm).toBe('');
    expect(component.selectedStatuses).toEqual([]);
    expect(component.selectedGrades).toEqual([]);
    expect(component.startDate).toBe('');
    expect(component.mobileSecondaryFilterCount).toBe(0);
    expect(component.mobileGlobalFiltersExpanded).toBe(true);
    expect(globalSearch.value).toBe('');
    expect(await statusSelect.getValueText()).toBe('');
    expect(await gradeSelect.getValueText()).toBe('');
    expect(await clearAll.isDisabled()).toBe(true);
  });

  it('keeps secondary filters in a labelled mobile disclosure with an active count', async () => {
    projectsSubject.next([makeProject(1, 'SIT764', true)]);
    await syncView();

    const toggle = fixture.nativeElement.querySelector(
      'button[data-mobile-global-filter-toggle]',
    ) as HTMLButtonElement;
    const filters = fixture.nativeElement.querySelector(
      '#dashboard-secondary-filters',
    ) as HTMLElement;

    expect(toggle.classList).toContain('min-h-12');
    expect(toggle.getAttribute('aria-controls')).toBe('dashboard-secondary-filters');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(filters.classList).not.toContain('is-mobile-open');
    expect(toggle.textContent).not.toContain('active');

    component.setStatuses(['complete', 'redo']);
    component.setGrades([1]);
    component.setStartDate('2026-08-01');
    await syncView();

    expect(component.mobileSecondaryFilterCount).toBe(4);
    expect(toggle.textContent).toContain('4 active');

    toggle.click();
    await syncView();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(filters.classList).toContain('is-mobile-open');
  });

  it('globally searches every required unit and task field case-insensitively', () => {
    projectsSubject.next([
      makeProject(
        1,
        'SIT764',
        true,
        [
          makeTask(
            'Individual Retrospective',
            '5.1D',
            'ready_for_feedback',
            new Date(2026, 7, 12),
            0,
            2,
          ),
        ],
        'Human Centred Design',
      ),
      makeProject(
        2,
        'SIT782',
        true,
        [makeTask('Network Plan', '2.1P', 'not_started', new Date(2026, 7, 18))],
        'Secure Networks',
      ),
    ]);

    const matchingQueries = [
      '  sit764  ',
      'HUMAN CENTRED',
      'individual retrospective',
      '5.1d',
      'Awaiting Feedback',
      'Distinction',
      'Wednesday 12 August',
      '12/08/2026',
      '2026-08-12',
    ];

    for (const query of matchingQueries) {
      component.setGlobalSearch(query);

      expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['SIT764']);
      expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['5.1D']);
    }

    component.setGlobalSearch(' - ');
    expect(component.globalSearchTerm).toBe(' - ');
    expect(component.hasGlobalTaskCriteria).toBe(false);
    expect(component.hasGlobalToolbarChanges).toBe(true);
    expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['SIT764', 'SIT782']);

    component.clearGlobalFilters();
    expect(component.globalSearchTerm).toBe('');
    expect(component.hasGlobalToolbarChanges).toBe(false);
  });

  it('filters by every trusted target-grade value and supports multiple grades', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Pass Task', 'LOOKS-HD', 'not_started', makeDate(10), 0, 0),
        makeTask('Credit Task', 'CREDIT', 'not_started', makeDate(11), 0, 1),
        makeTask('Distinction Task', 'DISTINCTION', 'not_started', makeDate(12), 0, 2),
        makeTask('High Distinction Task', 'LOOKS-P', 'not_started', makeDate(13), 0, 3),
      ]),
    ]);

    for (const option of component.gradeOptions) {
      component.setGrades([option.value]);

      expect(component.displayedUnits[0].tasks).toHaveLength(1);
      expect(component.displayedUnits[0].tasks[0].targetGrade).toBe(option.value);
      expect(component.displayedUnits[0].tasks[0].targetGradeLabel).toBe(option.label);
    }

    component.setGrades([0, 2]);

    expect(component.displayedUnits[0].tasks.map((task) => task.targetGrade)).toEqual([0, 2]);
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'LOOKS-HD',
      'DISTINCTION',
    ]);
  });

  it('filters by every existing task status and supports multiple statuses', () => {
    const tasks = TaskStatus.STATUS_KEYS.map((status, index) =>
      makeTask(
        `${TaskStatus.STATUS_LABELS.get(status)} Task`,
        `TASK-${index}`,
        status,
        makeDate(10),
      ),
    );
    projectsSubject.next([makeProject(1, 'SIT764', true, tasks)]);

    for (const status of TaskStatus.STATUS_KEYS) {
      component.setStatuses([status]);

      expect(component.displayedUnits[0].tasks).toHaveLength(1);
      expect(component.displayedUnits[0].tasks[0].status).toBe(status);
    }

    component.setStatuses(['complete', 'redo', 'fix_and_resubmit']);

    expect(component.displayedUnits[0].tasks.map((task) => task.status).sort()).toEqual([
      'complete',
      'fix_and_resubmit',
      'redo',
    ]);
  });

  it('uses OR within filter groups and AND across search, status and grade groups', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Security Pass', 'MATCH-P', 'complete', makeDate(10), 0, 0),
        makeTask('Security Credit', 'MATCH-C', 'fix_and_resubmit', makeDate(11), 0, 1),
        makeTask('Security Distinction', 'GRADE-OUT', 'complete', makeDate(12), 0, 2),
        makeTask('Security Redo', 'STATUS-OUT', 'redo', makeDate(13), 0, 0),
        makeTask('Calendar Credit', 'SEARCH-OUT', 'complete', makeDate(14), 0, 1),
      ]),
    ]);

    component.setGlobalSearch('security');
    component.setStatuses(['complete', 'fix_and_resubmit']);
    component.setGrades([0, 1]);

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'MATCH-C',
      'MATCH-P',
    ]);
  });

  it('applies global criteria in Previous units scope after authorised units load', () => {
    projectServiceQuery.mockReturnValue(
      of([
        makeProject(2, 'SIT704', false, [
          makeTask('Archived Pass Task', 'OLD-P', 'complete', makeDate(10), 0, 0),
          makeTask('Archived Distinction Task', 'OLD-D', 'complete', makeDate(11), 0, 2),
          makeTask('Archived Distinction Redo', 'OLD-REDO', 'redo', makeDate(12), 0, 2),
        ]),
      ]),
    );

    component.setUnitScope('previous');
    component.setGlobalSearch('archived');
    component.setStatuses(['complete']);
    component.setGrades([2]);

    expect(component.unitScope).toBe('previous');
    expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['SIT704']);
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['OLD-D']);
  });

  it('applies global search before an independent per-unit search', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Security Report', 'REPORT', 'not_started', makeDate(10)),
        makeTask('Security Plan', 'PLAN', 'not_started', makeDate(11)),
      ]),
      makeProject(2, 'SIT782', true, [
        makeTask('Security Calendar', 'CALENDAR', 'not_started', makeDate(12)),
      ]),
    ]);

    component.setGlobalSearch('security');

    expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['SIT764', 'SIT782']);
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'REPORT',
      'PLAN',
    ]);
    expect(component.displayedUnits[1].tasks.map((task) => task.abbreviation)).toEqual([
      'CALENDAR',
    ]);

    component.setSearch(1, 'report');

    expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['SIT764', 'SIT782']);
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['REPORT']);
    expect(component.displayedUnits[1].tasks.map((task) => task.abbreviation)).toEqual([
      'CALENDAR',
    ]);

    component.setSearch(1, '');

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'REPORT',
      'PLAN',
    ]);
  });

  it('clears global criteria, restores Active units and leaves canonical results', () => {
    const activeProject = makeProject(1, 'SIT764', true, [
      makeTask('Active Pass Task', 'ACTIVE-P', 'complete', makeDate(10), 0, 0),
      makeTask('Active Credit Task', 'ACTIVE-C', 'not_started', makeDate(11), 0, 1),
    ]);
    const previousProject = makeProject(2, 'SIT704', false, [
      makeTask('Previous Pass Task', 'PREVIOUS-P', 'complete', makeDate(12), 0, 0),
    ]);

    projectsSubject.next([activeProject]);
    projectServiceQuery.mockReturnValue(of([activeProject, previousProject]));

    component.setUnitScope('all');
    component.setGlobalSearch('pass');
    component.setStatuses(['complete']);
    component.setGrades([0]);
    component.setStartDate('2026-08-01');
    component.setEndDate('2026-08-31');

    expect(component.hasGlobalToolbarChanges).toBe(true);
    expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['SIT764', 'SIT704']);

    component.clearGlobalFilters();

    expect(component.unitScope).toBe('active');
    expect(component.globalSearchTerm).toBe('');
    expect(component.selectedStatuses).toEqual([]);
    expect(component.selectedGrades).toEqual([]);
    expect(component.startDate).toBe('');
    expect(component.endDate).toBe('');
    expect(component.hasGlobalToolbarChanges).toBe(false);
    expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['SIT764']);
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual([
      'ACTIVE-C',
      'ACTIVE-P',
    ]);
    expect(component.displayedUnits[0].gradeSummaries).toEqual([]);
  });

  it('removes globally empty units and renders the global no-results state', async () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Individual Retrospective', '5.1P', 'not_started', makeDate(12)),
      ]),
    ]);

    component.setGlobalSearch('not a matching task');
    await syncView();

    expect(component.displayedUnits).toEqual([]);
    expect(fixture.nativeElement.textContent).not.toContain('SIT764');
    expect(fixture.nativeElement.textContent).toContain(
      'No tasks match the current global search and filters.',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'No tasks match the current search and filters.',
    );
  });

  it('renders the global no-results state when the selected scope contains no units', async () => {
    projectsSubject.next([]);

    component.setGlobalSearch('security');
    await syncView();

    expect(component.displayedUnits).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain(
      'No tasks match the current global search and filters.',
    );
  });

  it('keeps grade summaries independent of global and per-unit search and status filters', async () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Completed Pass One', 'P1', 'complete', makeDate(10), 0, 0),
        makeTask('Completed Pass Two', 'P2', 'complete', makeDate(11), 0, 0),
        makeTask('Open Pass One', 'P3', 'not_started', makeDate(12), 0, 0),
        makeTask('Portfolio Pass', 'P4', 'assess_in_portfolio', makeDate(13), 0, 0),
      ]),
    ]);

    component.setGrades([0]);
    component.setStatuses(['not_started']);
    component.setGlobalSearch('open');
    component.setSearch(1, 'one');
    await syncView();

    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['P3']);
    expect(component.displayedUnits[0].gradeSummaries).toEqual([
      {
        targetGrade: 0,
        label: 'Pass',
        completed: 2,
        total: 4,
        percentage: 50,
      },
    ]);
    expect(fixture.nativeElement.textContent).toContain('Pass: 2 of 4 complete (50%)');
  });

  it('shows a zero-task summary for a selected grade on an otherwise visible unit', async () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Credit Task', 'C1', 'not_started', makeDate(10), 0, 1),
      ]),
    ]);

    component.setGrades([0, 1]);
    await syncView();

    expect(component.displayedUnits).toHaveLength(1);
    expect(component.displayedUnits[0].gradeSummaries).toEqual([
      {
        targetGrade: 0,
        label: 'Pass',
        completed: 0,
        total: 0,
        percentage: null,
      },
      {
        targetGrade: 1,
        label: 'Credit',
        completed: 0,
        total: 1,
        percentage: 0,
      },
    ]);
    expect(fixture.nativeElement.textContent).toContain('Pass: 0 tasks');
    expect(fixture.nativeElement.textContent).toContain('Credit: 0 of 1 complete (0%)');
    expect(fixture.nativeElement.textContent).not.toContain('Pass: 0 of 0 complete (0%)');
  });

  it('calculates summaries independently per unit using trusted task-definition labels', () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Foundation Complete', 'F1', 'complete', makeDate(10), 0, 0, 'Foundation'),
        makeTask('Foundation Open', 'F2', 'not_started', makeDate(11), 0, 0, 'Foundation'),
      ]),
      makeProject(2, 'SIT782', true, [
        makeTask('Entry Complete One', 'E1', 'complete', makeDate(12), 0, 0, 'Entry'),
        makeTask('Entry Complete Two', 'E2', 'complete', makeDate(13), 0, 0, 'Entry'),
        makeTask('Entry Open', 'E3', 'redo', makeDate(14), 0, 0, 'Entry'),
      ]),
    ]);

    component.setGrades([0]);

    expect(component.displayedUnits[0].gradeSummaries).toEqual([
      {
        targetGrade: 0,
        label: 'Foundation',
        completed: 1,
        total: 2,
        percentage: 50,
      },
    ]);
    expect(component.displayedUnits[1].gradeSummaries).toEqual([
      {
        targetGrade: 0,
        label: 'Entry',
        completed: 2,
        total: 3,
        percentage: 67,
      },
    ]);
  });

  it('hides all grade summaries until a grade filter is selected', async () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [makeTask('Pass Task', 'P1', 'complete', makeDate(10), 0, 0)]),
    ]);

    await syncView();

    expect(component.displayedUnits[0].gradeSummaries).toEqual([]);
    expect(fixture.nativeElement.textContent).not.toContain('Grade task completion');
  });

  it('renders one accessible mobile accordion control and summary per unit', async () => {
    const overdueDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const laterDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    projectsSubject.next([
      makeProject(
        1,
        'SIT764',
        true,
        [
          makeTask('Overdue review', 'OVERDUE', 'not_started', overdueDate),
          makeTask('Later review', 'LATER', 'not_started', laterDate),
        ],
        'Human Centred Design',
      ),
      makeProject(2, 'SIT782', true, [makeTask('Submitted plan', 'DONE', 'complete', laterDate)]),
    ]);

    await syncView();

    const toggles = fixture.nativeElement.querySelectorAll(
      'button[data-mobile-unit-toggle]',
    ) as NodeListOf<HTMLButtonElement>;

    expect(toggles).toHaveLength(2);
    expect(toggles[0].parentElement?.tagName).toBe('H2');
    expect(toggles[0].classList).toContain('min-h-12');
    expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
    expect(toggles[0].getAttribute('aria-controls')).toBe(
      'dashboard-unit-controls-1 dashboard-unit-content-1',
    );
    expect(toggles[0].textContent).toContain('SIT764');
    expect(toggles[0].textContent).toContain('Human Centred Design · Active');
    expect(toggles[0].textContent).toContain('2 tasks');
    expect(toggles[0].textContent).toContain('Overdue: OVERDUE');
    expect(toggles[1].textContent).toContain('1 task');
    expect(toggles[1].textContent).toContain('No upcoming deadlines');
    expect(toggles[0].querySelector('a, input, button')).toBeNull();
    expect(fixture.nativeElement.querySelector('#dashboard-unit-controls-1')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#dashboard-unit-content-1')).not.toBeNull();

    // The responsive view reuses each task row instead of duplicating separate mobile markup.
    expect(fixture.nativeElement.querySelectorAll('f-dashboard-list-item')).toHaveLength(3);
  });

  it('opens only one mobile unit at a time and resets expansion when scope changes', async () => {
    projectsSubject.next([makeProject(1, 'SIT764', true), makeProject(2, 'SIT782', true)]);
    await syncView();

    const toggles = fixture.nativeElement.querySelectorAll(
      'button[data-mobile-unit-toggle]',
    ) as NodeListOf<HTMLButtonElement>;
    const firstControls = fixture.nativeElement.querySelector(
      '#dashboard-unit-controls-1',
    ) as HTMLElement;
    const firstContent = fixture.nativeElement.querySelector(
      '#dashboard-unit-content-1',
    ) as HTMLElement;
    const secondContent = fixture.nativeElement.querySelector(
      '#dashboard-unit-content-2',
    ) as HTMLElement;

    toggles[0].click();
    await syncView();

    expect(toggles[0].getAttribute('aria-expanded')).toBe('true');
    expect(firstControls.classList).toContain('is-mobile-open');
    expect(firstContent.classList).toContain('is-mobile-open');

    toggles[1].click();
    await syncView();

    expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
    expect(toggles[1].getAttribute('aria-expanded')).toBe('true');
    expect(firstControls.classList).not.toContain('is-mobile-open');
    expect(firstContent.classList).not.toContain('is-mobile-open');
    expect(secondContent.classList).toContain('is-mobile-open');

    component.setUnitScope('active');
    await syncView();

    expect(component.expandedMobileProjectId).toBeNull();
    expect(toggles[1].getAttribute('aria-expanded')).toBe('false');
  });

  it('uses phone-safe widths while retaining the fixed desktop card strip', async () => {
    projectsSubject.next([makeProject(1, 'SIT764', true)]);
    await syncView();

    const toolbar = fixture.nativeElement.querySelector(
      '[aria-label="Global dashboard filters"]',
    ) as HTMLElement;
    const globalSearchField = fixture.nativeElement
      .querySelector('input[aria-label="Global search"]')
      .closest('mat-form-field') as HTMLElement;
    const layout = fixture.nativeElement.querySelector('.dashboard-units-layout') as HTMLElement;
    const card = layout.querySelector('section') as HTMLElement;

    expect(Array.from(toolbar.classList)).toEqual(expect.arrayContaining(['px-4', 'sm:px-16']));
    expect(Array.from(globalSearchField.classList)).toEqual(
      expect.arrayContaining(['min-w-0', 'sm:min-w-64']),
    );
    expect(Array.from(layout.classList)).toEqual(
      expect.arrayContaining([
        'flex-col',
        'overflow-x-hidden',
        'sm:flex-row',
        'sm:overflow-x-auto',
      ]),
    );
    expect(Array.from(card.classList)).toEqual(
      expect.arrayContaining(['h-auto', 'w-full', 'min-w-0', 'sm:h-full', 'sm:w-128']),
    );
  });
});
