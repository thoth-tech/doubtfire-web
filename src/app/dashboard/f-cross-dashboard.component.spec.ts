import {enAU} from 'date-fns/locale';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {CommonModule} from '@angular/common';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ReactiveFormsModule} from '@angular/forms';
import {provideDateFnsAdapter} from '@angular/material-date-fns-adapter';
import {MatButtonModule} from '@angular/material/button';
import {MatButtonHarness} from '@angular/material/button/testing';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MAT_DATE_LOCALE} from '@angular/material/core';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatDateRangeInputHarness} from '@angular/material/datepicker/testing';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatMenuModule} from '@angular/material/menu';
import {MatSelectModule} from '@angular/material/select';
import {MatSelectHarness} from '@angular/material/select/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {ActivatedRoute, Router, convertToParamMap} from '@angular/router';
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
      projectLoadErrorSubject: new BehaviorSubject(false),
      onLoad: (callback: () => void): void => callback(),
      currentUserProjects: {
        values: projectsSubject.asObservable(),
        get currentValues(): Project[] {
          return projectsSubject.value;
        },
      },
    };

    const projectServiceStub = {
      query: vi.fn(() => {
        throw new Error('Explicit refresh must bypass the query cache');
      }),
      fetchAll: projectServiceQuery,
    };

    await TestBed.configureTestingModule({
      declarations: [CrossDashboardComponent],
      imports: [
        CommonModule,
        MatButtonModule,
        MatCheckboxModule,
        MatDatepickerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatMenuModule,
        MatSelectModule,
        NoopAnimationsModule,
        ReactiveFormsModule,
      ],
      providers: [
        // The app's own date setup (doubtfire-angular.module.ts), so typed dates
        // are read day-first the way an Australian student enters them.
        {provide: MAT_DATE_LOCALE, useValue: enAU},
        provideDateFnsAdapter({
          parse: {dateInput: 'dd/MM/yyyy'},
          display: {
            dateInput: 'dd/MM/yyyy',
            monthYearLabel: 'MMMM yyyy',
            dateA11yLabel: 'do MMMM yyyy',
            monthYearA11yLabel: 'MMMM yyyy',
          },
        }),
        {provide: ActivatedRoute, useValue: {queryParamMap: of(convertToParamMap({}))}},
        {provide: Router, useValue: {navigate: vi.fn().mockResolvedValue(true)}},
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

  it('maps feedback metadata and preserves missing metadata as unavailable', () => {
    const noMetadataTask = makeTask('No feedback metadata', '1.1P', 'working_on_it', makeDate(10));
    const feedbackTask = makeTask('Task with feedback', '1.2P', 'fix_and_resubmit', makeDate(11));

    feedbackTask.hasFeedback = true;

    projectsSubject.next([makeProject(1, 'COS10001', true, [noMetadataTask, feedbackTask])]);

    const mappedTasks = component.activeUnits[0].tasks;

    expect(mappedTasks.find((task) => task.abbreviation === '1.1P')?.hasFeedback).toBeNull();
    expect(mappedTasks.find((task) => task.abbreviation === '1.2P')?.hasFeedback).toBe(true);
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

  it('renders labelled per-unit search with its placeholder and keyboard focus', async () => {
    projectsSubject.next([makeProject(1, 'SIT764', true)]);

    await syncView();

    const searchInput = fixture.nativeElement.querySelector(
      'input[aria-label="Search tasks in SIT764"]',
    ) as HTMLInputElement;

    // Themed token utilities (flip with data-ot-theme) replaced the literal
    // bg-white / text-gray-900 / placeholder:text-gray-600 during the theme migration.
    expect(searchInput.classList.contains('bg-ot-surface')).toBe(true);
    expect(searchInput.classList.contains('text-ot-text')).toBe(true);
    expect(searchInput.classList.contains('placeholder:text-ot-muted')).toBe(true);
    expect(searchInput.classList.contains('placeholder:opacity-100')).toBe(true);
    expect(searchInput.placeholder).toBe('Search tasks');
    expect(searchInput.type).toBe('search');
    searchInput.focus();
    expect(document.activeElement).toBe(searchInput);
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

  // The text in the menu item is not a label element, so the box needs its own name.
  it('names the per-unit filter box after the filter it turns on', async () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Individual Retrospective', '5.1P', 'not_started', makeDate(12)),
      ]),
    ]);

    await syncView();

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const filterButton = await loader.getHarness(
      MatButtonHarness.with({selector: '[aria-label^="Filter tasks in"]'}),
    );
    await filterButton.click();
    await syncView();

    const item = document.querySelector('.mat-mdc-menu-panel .mat-mdc-menu-item') as HTMLElement;
    const icon = item?.querySelector('mat-icon') as HTMLElement;

    // the item is the checkbox, so its own text is the name and the icon stays quiet
    expect(item?.getAttribute('role')).toBe('menuitemcheckbox');
    expect(item?.getAttribute('aria-checked')).toBe('false');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(item?.textContent.replace(icon?.textContent ?? '', '').trim()).toBe('Hide Completed');
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

  it('uses phone-safe widths while retaining the desktop card strip', async () => {
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
      expect.arrayContaining(['h-auto', 'w-full', 'min-w-0', 'sm:h-full', 'sm:flex-[1_0_26rem]']),
    );
  });

  it('combines feedback with status, grade, date, unit and task searches', () => {
    const match = makeTask('Review report', 'D1', 'redo', makeDate(10), 0, 2);
    match.hasFeedback = true;
    const noFeedback = makeTask('Review report', 'D2', 'redo', makeDate(10), 1, 2);
    noFeedback.hasFeedback = false;
    const wrongGrade = makeTask('Review report', 'P1', 'redo', makeDate(10), 2, 0);
    wrongGrade.hasFeedback = true;
    projectsSubject.next([makeProject(1, 'SIT764', true, [match, noFeedback, wrongGrade])]);
    component.setFeedbackFilter('available');
    component.setStatuses(['redo']);
    component.setGrades([2]);
    component.setGlobalSearch('SIT764 staff feedback');
    component.setSearch(1, 'review');
    component.setStartDate('2026-08-10');
    component.setEndDate('2026-08-10');
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['D1']);
    component.clearGlobalFilters();
    expect(component.feedbackFilter).toBe('all');
    expect(component.displayedUnits[0].tasks).toHaveLength(3);
  });

  it('distinguishes no feedback from unavailable data and searchable unread comments', () => {
    const missing = makeTask('Unknown', 'U1', 'working_on_it', makeDate(10));
    const none = makeTask('None', 'N1', 'working_on_it', makeDate(10));
    none.hasFeedback = false;
    const present = makeTask('Feedback', 'F1', 'redo', makeDate(10));
    present.hasFeedback = true;
    present.numNewComments = 2;
    projectsSubject.next([makeProject(1, 'SIT764', true, [missing, none, present])]);
    component.setFeedbackFilter('unavailable');
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['U1']);
    component.setFeedbackFilter('none');
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['N1']);
    component.setFeedbackFilter('available');
    component.setGlobalSearch('unread comments');
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['F1']);
  });

  it('preserves the active refresh button and stale tasks across failure and recovery', async () => {
    projectsSubject.next([makeProject(1, 'SIT764', true)]);
    const refresh: Subject<Project[]> = new Subject();
    projectServiceQuery.mockReturnValue(refresh);
    const button = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((item) => item.textContent.includes('Refresh active units'));
    button.focus();
    button.click();
    button.click();
    await syncView();
    expect(projectServiceQuery).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    refresh.error(new Error('private response body'));
    await syncView();
    expect(component.activeUnitsLoadError).toBe(true);
    expect(component.displayedUnits[0].code).toBe('SIT764');
    expect(fixture.nativeElement.textContent).toContain('Showing previously loaded tasks');
    expect(fixture.nativeElement.textContent).not.toContain('private response body');
    expect(document.activeElement).toBe(button);
    projectServiceQuery.mockReturnValue(of([makeProject(2, 'SIT777', true)]));
    button.click();
    await syncView();
    expect(component.activeUnitsLoadError).toBe(false);
    expect(component.displayedUnits[0].code).toBe('SIT777');
    expect(document.activeElement).toBe(button);
  });

  it('retries previous units once, retaining the last successful data on failure', async () => {
    projectServiceQuery.mockReturnValue(of([makeProject(1, 'OLD101', false)]));
    component.setUnitScope('previous');
    const refresh: Subject<Project[]> = new Subject();
    projectServiceQuery.mockReturnValue(refresh);
    component.loadPreviousUnits();
    component.loadPreviousUnits();
    expect(projectServiceQuery).toHaveBeenCalledTimes(2);
    refresh.error(new Error('offline'));
    await syncView();
    expect(component.displayedUnits[0].code).toBe('OLD101');
    expect(fixture.nativeElement.textContent).toContain('Showing previously loaded tasks');
    projectServiceQuery.mockReturnValue(of([]));
    component.loadPreviousUnits();
    await syncView();
    expect(component.previousUnitsLoadError).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No previous units are available.');
  });

  it('keeps tasks usable when recommendation loading fails and allows recovery', async () => {
    projectsSubject.next([makeProject(1, 'SIT764', true)]);
    recommendationServiceGetAll.mockReturnValue(throwError(() => new Error('offline')));
    component.retryRecommendations();
    await syncView();
    expect(component.recommendationsLoadError).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Tasks remain available');
    recommendationServiceGetAll.mockReturnValue(of([]));
    component.retryRecommendations();
    await syncView();
    expect(component.recommendationsLoadError).toBe(false);
  });

  it('announces results and keeps project progress and primary links in compact density', async () => {
    projectsSubject.next([
      makeProject(
        1,
        'LONG101',
        true,
        [makeTask('A long task', 'L1', 'complete', makeDate(10))],
        'A very long synthetic project name with no clipped required information',
      ),
    ]);
    component.density = 'compact';
    await syncView();
    expect(fixture.nativeElement.querySelector('.dashboard-compact')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('p[aria-live="polite"]').textContent).toContain(
      '1 task in 1 unit',
    );
    expect(fixture.nativeElement.textContent).toContain('1 of 1 tasks complete');
    expect(fixture.nativeElement.textContent).toContain('Open LONG101 dashboard');
  });

  it('allows recovery when global project loading failed before the dashboard opened', async () => {
    const global = TestBed.inject(GlobalStateService);
    global.projectLoadErrorSubject.next(true);
    fixture.destroy();
    fixture = TestBed.createComponent(CrossDashboardComponent);
    component = fixture.componentInstance;
    await syncView();
    expect(component.activeUnitsLoadError).toBe(true);
    expect(component.loadingActiveUnits).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Active units could not be loaded');
    projectServiceQuery.mockReturnValue(of([makeProject(1, 'SIT764', true)]));
    component.retryActiveUnits();
    await syncView();
    expect(component.activeUnitsLoadError).toBe(false);
    expect(global.projectLoadErrorSubject.value).toBe(false);
    expect(component.displayedUnits[0].code).toBe('SIT764');
  });

  it('does not resurrect projects absent from a successful refresh when the entity cache emits', async () => {
    const remaining = makeProject(1, 'CURRENT', true, [
      makeTask('Current', 'P1', 'redo', makeDate(10)),
    ]);
    const removed = makeProject(2, 'REMOVED', true);
    projectsSubject.next([remaining, removed]);
    projectServiceQuery.mockReturnValue(of([remaining]));
    component.retryActiveUnits();
    projectsSubject.next([remaining, removed]);
    taskStatusSubject.next(remaining.tasks[0]);
    await syncView();
    expect(component.displayedUnits.map((unit) => unit.code)).toEqual(['CURRENT']);
  });

  it('summarises each unit by status for the header progress bar', async () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('First', 'A', 'complete', makeDate(10)),
        makeTask('Second', 'B', 'working_on_it', makeDate(11)),
        makeTask('Third', 'C', 'not_started', makeDate(12)),
        makeTask('Fourth', 'D', 'complete', makeDate(13)),
      ]),
    ]);
    await syncView();

    const progress = component.displayedUnits[0].progress;

    expect(progress.completed).toBe(2);
    expect(progress.total).toBe(4);
    expect(progress.percentage).toBe(50);
    expect(progress.segments.map(({status, count}) => [status, count])).toEqual([
      ['not_started', 1],
      ['working_on_it', 1],
      ['complete', 2],
    ]);
    expect(progress.ariaLabel).toBe('Task statuses: 1 Not Started, 1 Working On It, 2 Complete');
    expect(fixture.nativeElement.textContent).toContain('2 of 4 complete');

    // The bar describes the whole unit, so a column search does not shrink it.
    component.setSearch(1, 'first');
    await syncView();

    expect(component.displayedUnits[0].tasks).toHaveLength(1);
    expect(component.displayedUnits[0].progress.total).toBe(4);
  });

  it('counts open overdue and soon-due work in active units for the page summary', async () => {
    const day = 24 * 60 * 60 * 1000;
    const inDays = (days: number): Date => new Date(Date.now() + days * day);

    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Late', 'LATE', 'not_started', inDays(-1)),
        makeTask('Soon', 'SOON', 'working_on_it', inDays(2)),
        makeTask('Finished late', 'DONE', 'complete', inDays(-2)),
        makeTask('Handed in', 'SENT', 'ready_for_feedback', inDays(-3)),
        makeTask('Far away', 'FAR', 'not_started', inDays(30)),
      ]),
      makeProject(2, 'SIT782', false, [makeTask('Old', 'OLD', 'not_started', inDays(-5))]),
    ]);
    await syncView();

    expect(component.summary).toEqual({unitLabel: '1 active unit', overdue: 1, dueSoon: 1});
    expect(fixture.nativeElement.textContent).toContain('1 overdue');
    expect(fixture.nativeElement.textContent).toContain('1 due within 7 days');

    // Searching one column leaves the page-level counts alone.
    component.setGlobalSearch('far away');
    await syncView();

    expect(component.summary.overdue).toBe(1);
  });

  it('moves a task from due soon to overdue when its deadline passes on an open page', async () => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(new Date(2026, 7, 10, 9, 0, 0));

    try {
      projectsSubject.next([
        makeProject(1, 'SIT764', true, [
          makeTask('Due at ten', 'TEN', 'not_started', new Date(2026, 7, 10, 10, 0, 0)),
        ]),
      ]);
      await syncView();

      expect(component.summary).toEqual({unitLabel: '1 active unit', overdue: 0, dueSoon: 1});

      vi.setSystemTime(new Date(2026, 7, 10, 11, 0, 0));

      expect(component.summary).toEqual({unitLabel: '1 active unit', overdue: 1, dueSoon: 0});
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives neighbouring active units different accents and finished units the slate band', async () => {
    projectsSubject.next(
      Array.from({length: 7}, (_, index) => makeProject(index + 1, `UNIT${index + 1}`, true)),
    );
    await syncView();

    expect(component.displayedUnits.map((unit) => unit.accent)).toEqual([
      'var(--ot-unit-1)',
      'var(--ot-unit-2)',
      'var(--ot-unit-3)',
      'var(--ot-unit-4)',
      'var(--ot-unit-5)',
      'var(--ot-unit-6)',
      'var(--ot-unit-1)',
    ]);

    const firstCard = fixture.nativeElement.querySelector('section.unit-card') as HTMLElement;
    expect(firstCard.style.getPropertyValue('--unit-accent')).toBe('var(--ot-unit-1)');

    projectsSubject.next([makeProject(1, 'SIT764', true), makeProject(2, 'SIT782', false)]);
    await syncView();

    expect(component.activeUnits.map((unit) => unit.accent)).toEqual(['var(--ot-unit-1)']);
  });

  it('marks previous units with the slate band', () => {
    projectServiceQuery.mockReturnValue(of([makeProject(9, 'SIT700', false)]));

    component.setUnitScope('previous');

    expect(component.displayedUnits.map((unit) => unit.accent)).toEqual([
      'var(--ot-unit-previous)',
    ]);
  });

  it('filters by the dates typed into the range field, day first', async () => {
    projectsSubject.next([
      makeProject(1, 'SIT764', true, [
        makeTask('Early Task', 'EARLY', 'not_started', makeDate(5)),
        makeTask('Middle Task', 'MIDDLE', 'not_started', makeDate(12)),
        makeTask('Late Task', 'LATE', 'not_started', makeDate(20)),
      ]),
    ]);
    await syncView();

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const range = await loader.getHarness(MatDateRangeInputHarness);
    const start = await range.getStartInput();
    const end = await range.getEndInput();

    await start.setValue('10/08/2026');
    await end.setValue('15/08/2026');
    await end.blur();
    await syncView();

    expect(component.startDate).toBe('2026-08-10');
    expect(component.endDate).toBe('2026-08-15');
    expect(component.displayedUnits[0].tasks.map((task) => task.abbreviation)).toEqual(['MIDDLE']);

    await loader
      .getHarness(MatButtonHarness.with({selector: '[aria-label="Clear dates"]'}))
      .then((clear) => clear.click());
    await syncView();

    expect(await start.getValue()).toBe('');
    expect(await end.getValue()).toBe('');
    expect(component.displayedUnits[0].tasks).toHaveLength(3);
  });

  it('re-checks both ends when one is corrected, so no stale range error stays', async () => {
    projectsSubject.next([makeProject(1, 'SIT764', true)]);
    await syncView();

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const range = await loader.getHarness(MatDateRangeInputHarness);
    const start = await range.getStartInput();
    const end = await range.getEndInput();

    await start.setValue('20/08/2026');
    await end.setValue('15/08/2026');
    await end.blur();
    await syncView();

    expect(component.dateRange.controls.end.valid).toBe(false);

    await start.setValue('10/08/2026');
    await start.blur();
    await syncView();

    expect(component.dateRange.controls.start.valid).toBe(true);
    expect(component.dateRange.controls.end.valid).toBe(true);
    expect(component.dateRangeError).toBeNull();
  });

  it('filters the dashboard once when the dates are cleared', async () => {
    projectsSubject.next([makeProject(1, 'SIT764', true)]);
    await syncView();
    component.setStartDate('2026-08-10');
    component.setEndDate('2026-08-15');
    const processTasks = vi.spyOn(
      component as unknown as {processTasks: () => void},
      'processTasks',
    );

    component.clearDateRange();

    expect(processTasks).toHaveBeenCalledTimes(1);
  });

  it('flags a typo in the date field and clears it with Clear all', async () => {
    projectsSubject.next([makeProject(1, 'SIT764', true)]);
    await syncView();

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const start = await (await loader.getHarness(MatDateRangeInputHarness)).getStartInput();

    await start.setValue('31/31/2026');
    await start.blur();
    await syncView();

    // Nothing parsed, so nothing filters, but the field still holds text to clear.
    expect(component.startDate).toBe('');
    expect(component.hasGlobalToolbarChanges).toBe(true);
    expect(fixture.nativeElement.querySelector('mat-error')?.textContent).toContain(
      'Enter dates as dd/mm/yyyy.',
    );

    await (await loader.getHarness(MatButtonHarness.with({text: 'Clear all'}))).click();
    await syncView();

    expect(await start.getValue()).toBe('');
    expect(fixture.nativeElement.querySelector('mat-error')).toBeNull();
    expect(component.hasGlobalToolbarChanges).toBe(false);
  });
});
