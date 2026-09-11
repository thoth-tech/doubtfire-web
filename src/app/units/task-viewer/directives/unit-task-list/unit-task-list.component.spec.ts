import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA, SimpleChange} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router, convertToParamMap} from '@angular/router';
import {BehaviorSubject, Subject} from 'rxjs';
import {Project, Task, TaskDefinition} from 'src/app/api/models/doubtfire-model';
import {FUnitTaskListComponent} from './unit-task-list.component';

const emptyProvider = {};

const flushTaskSelection = async (): Promise<void> => {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
};

const taskDefinition = (
  id: number,
  abbreviation: string,
  startDate = new Date(2026, 0, id + 1),
  targetGrade = 0,
): TaskDefinition =>
  ({
    id,
    seq: id,
    abbreviation,
    name: abbreviation,
    startDate,
    targetGrade,
    targetGradeText: 'Pass',
  }) as TaskDefinition;

const taskForDefinition = (
  definition: TaskDefinition,
  topWeight: number,
  numNewComments = 0,
): Task =>
  ({
    definition,
    topWeight,
    numNewComments,
  }) as Task;

const studentProject = () =>
  ({
    id: 10,
    targetGrade: 0,
    unit: {id: 20},
    calcTopTasks: () => undefined,
  }) as unknown as Project;

// Mirrors the wiring ngOnInit does, without the route lookup it also performs.
const openTaskDefinition = (
  component: FUnitTaskListComponent,
  taskDef: TaskDefinition,
): BehaviorSubject<TaskDefinition> => {
  const selectedTaskDefinition$: BehaviorSubject<TaskDefinition> = new BehaviorSubject(taskDef);
  component.selectedTaskDefinition$ = selectedTaskDefinition$;
  selectedTaskDefinition$.subscribe((value) => (component.selectedTaskDef = value));

  return selectedTaskDefinition$;
};

describe('FUnitTaskListComponent', () => {
  let component: FUnitTaskListComponent;
  let fixture: ComponentFixture<FUnitTaskListComponent>;
  let routeParamMap$: Subject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);
    routeParamMap$ = new Subject<ReturnType<typeof convertToParamMap>>();

    await TestBed.configureTestingModule({
      declarations: [FUnitTaskListComponent],
      providers: [
        {provide: Router, useValue: emptyProvider},
        {
          provide: ActivatedRoute,
          useValue: {paramMap: routeParamMap$.asObservable()},
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(FUnitTaskListComponent, {set: {template: ''}})
      .compileComponents();
  });

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
    fixture = TestBed.createComponent(FUnitTaskListComponent);
    component = fixture.componentInstance;
    component.taskDefinitions = [];
    component.tasks = [];
    component.selectedTaskDefinition$ = new BehaviorSubject<TaskDefinition>(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('follows task route changes without recreating the component', async () => {
    const firstTask = taskDefinition(1, '1.1P');
    const secondTask = taskDefinition(2, '2.3P');

    component.taskDefinitions = [firstTask, secondTask];

    fixture.detectChanges();

    routeParamMap$.next(
      convertToParamMap({
        taskAbbreviation: firstTask.abbreviation,
      }),
    );

    await flushTaskSelection();

    expect(component.selectedTaskDefinition$.value).toBe(firstTask);
    expect(component.selectedTaskDef).toBe(firstTask);

    routeParamMap$.next(
      convertToParamMap({
        taskAbbreviation: secondTask.abbreviation,
      }),
    );

    await flushTaskSelection();

    expect(component.selectedTaskDefinition$.value).toBe(secondTask);
    expect(component.selectedTaskDef).toBe(secondTask);
  });

  // The unit resolves progressively, so on a hard refresh of a deep link the
  // route parameter arrives while taskDefinitions is still empty. Nothing used to
  // re-apply it once the list turned up, and the screen landed on no task.
  it('applies a deep linked task once the task definitions arrive', async () => {
    const task = taskDefinition(1, '1.1P');

    component.taskDefinitions = [];
    fixture.detectChanges();

    routeParamMap$.next(convertToParamMap({taskAbbreviation: task.abbreviation}));
    await flushTaskSelection();

    expect(component.selectedTaskDefinition$.value).toBeNull();

    component.taskDefinitions = [task];
    component.ngOnChanges({taskDefinitions: {} as never});
    await flushTaskSelection();

    expect(component.selectedTaskDefinition$.value).toBe(task);
  });

  it('clears a stale selection when the route task does not exist', async () => {
    const existingTask = taskDefinition(1, '1.1P');

    component.taskDefinitions = [existingTask];

    fixture.detectChanges();

    routeParamMap$.next(
      convertToParamMap({
        taskAbbreviation: existingTask.abbreviation,
      }),
    );

    await flushTaskSelection();

    expect(component.selectedTaskDefinition$.value).toBe(existingTask);

    routeParamMap$.next(
      convertToParamMap({
        taskAbbreviation: 'does-not-exist',
      }),
    );

    await flushTaskSelection();

    expect(component.selectedTaskDefinition$.value).toBeNull();
    expect(component.selectedTaskDef).toBeNull();
  });

  it('clears the selection when the task parameter is removed', async () => {
    const existingTask = taskDefinition(1, '1.1P');

    component.taskDefinitions = [existingTask];

    fixture.detectChanges();

    routeParamMap$.next(
      convertToParamMap({
        taskAbbreviation: existingTask.abbreviation,
      }),
    );

    await flushTaskSelection();

    expect(component.selectedTaskDefinition$.value).toBe(existingTask);

    routeParamMap$.next(convertToParamMap({}));

    await flushTaskSelection();

    expect(component.selectedTaskDefinition$.value).toBeNull();
    expect(component.selectedTaskDef).toBeNull();
  });

  it('stops following route changes after the component is destroyed', async () => {
    const firstTask = taskDefinition(1, '1.1P');
    const secondTask = taskDefinition(2, '2.3P');

    component.taskDefinitions = [firstTask, secondTask];

    fixture.detectChanges();

    routeParamMap$.next(
      convertToParamMap({
        taskAbbreviation: firstTask.abbreviation,
      }),
    );

    await flushTaskSelection();

    expect(component.selectedTaskDefinition$.value).toBe(firstTask);

    component.ngOnDestroy();

    routeParamMap$.next(
      convertToParamMap({
        taskAbbreviation: secondTask.abbreviation,
      }),
    );

    await flushTaskSelection();

    expect(component.selectedTaskDefinition$.value).toBe(firstTask);
    expect(component.selectedTaskDef).toBe(firstTask);
  });

  it('sorts task definitions by task top weight by default', () => {
    const middlePriorityTask = taskDefinition(0, 'C');
    const lowPriorityTask = taskDefinition(1, 'A');
    const highPriorityTask = taskDefinition(2, 'B');

    component.taskDefinitions = [lowPriorityTask, middlePriorityTask, highPriorityTask];

    component.tasks = [
      taskForDefinition(middlePriorityTask, 1),
      taskForDefinition(lowPriorityTask, 2),
      taskForDefinition(highPriorityTask, 0),
    ];

    component.applyFilters();

    expect(component.filteredTaskDefinitions).toEqual([
      highPriorityTask,
      middlePriorityTask,
      lowPriorityTask,
    ]);
  });

  it('restores top weight order when switching back to default sorting', () => {
    const middlePriorityTask = taskDefinition(0, 'C');
    const lowPriorityTask = taskDefinition(1, 'A');
    const highPriorityTask = taskDefinition(2, 'B');

    component.taskDefinitions = [lowPriorityTask, middlePriorityTask, highPriorityTask];

    component.tasks = [
      taskForDefinition(middlePriorityTask, 1),
      taskForDefinition(lowPriorityTask, 2),
      taskForDefinition(highPriorityTask, 0),
    ];

    component.setSortBy('abbreviation');

    expect(component.filteredTaskDefinitions).toEqual([
      lowPriorityTask,
      highPriorityTask,
      middlePriorityTask,
    ]);

    component.setSortBy('default');

    expect(component.filteredTaskDefinitions).toEqual([
      highPriorityTask,
      middlePriorityTask,
      lowPriorityTask,
    ]);
  });

  it('falls back to task definition sequence when no task is available', () => {
    const firstTask = taskDefinition(0, 'C');
    const secondTask = taskDefinition(1, 'A');
    const thirdTask = taskDefinition(2, 'B');

    component.taskDefinitions = [thirdTask, firstTask, secondTask];

    component.applyFilters();

    expect(component.filteredTaskDefinitions).toEqual([firstTask, secondTask, thirdTask]);
  });

  it('shows only tasks at or below the project target grade by default', () => {
    const passTask = taskDefinition(1, 'P1', undefined, 0);
    const creditTask = taskDefinition(2, 'C1', undefined, 1);
    const distinctionTask = taskDefinition(3, 'D1', undefined, 2);
    component.project = {
      id: 10,
      targetGrade: 0,
      unit: {id: 20},
    } as Project;
    component.targetGrade = 0;
    component.taskDefinitions = [passTask, creditTask, distinctionTask];
    component.tasks = [];

    component.applyFilters();

    expect(component.filteredTaskDefinitions).toEqual([passTask]);
    expect(component.activeViewPreferenceCount).toBe(1);
  });

  it('reveals tasks beyond the target grade only when explicitly selected', () => {
    const passTask = taskDefinition(1, 'P1', undefined, 0);
    const creditTask = taskDefinition(2, 'C1', undefined, 1);
    component.project = {
      id: 10,
      targetGrade: 0,
      unit: {id: 20},
    } as Project;
    component.targetGrade = 0;
    component.taskDefinitions = [passTask, creditTask];
    component.tasks = [];

    component.toggleShowAboveTargetGrade(true);

    expect(component.filteredTaskDefinitions).toEqual([passTask, creditTask]);
    expect(component.activeViewPreferenceCount).toBe(0);

    component.resetViewPreferences();

    expect(component.filteredTaskDefinitions).toEqual([passTask]);
    expect(component.activeViewPreferenceCount).toBe(1);
  });

  it('reapplies target-grade filtering when the selected target changes', () => {
    const passTask = taskDefinition(1, 'P1', undefined, 0);
    const creditTask = taskDefinition(2, 'C1', undefined, 1);
    component.project = {
      id: 10,
      targetGrade: 0,
      unit: {id: 20},
    } as Project;
    component.targetGrade = 0;
    component.taskDefinitions = [passTask, creditTask];
    component.tasks = [];
    component.applyFilters();

    component.targetGrade = 1;
    component.project.targetGrade = 1;
    component.ngOnChanges({targetGrade: new SimpleChange(0, 1, false)});

    expect(component.filteredTaskDefinitions).toEqual([passTask, creditTask]);
  });

  it('does not grade-filter an all-tasks list without a student project', () => {
    const passTask = taskDefinition(1, 'P1', undefined, 0);
    const distinctionTask = taskDefinition(2, 'D1', undefined, 2);
    component.mode = 'all-tasks';
    component.taskDefinitions = [passTask, distinctionTask];
    component.tasks = [];

    component.applyFilters();

    expect(component.filteredTaskDefinitions).toEqual([passTask, distinctionTask]);
  });

  it('keeps the open task selected when the search term stops matching it', () => {
    const openTask = taskDefinition(1, 'P1');
    const otherTask = taskDefinition(2, 'P2');
    component.project = studentProject();
    component.targetGrade = 0;
    component.taskDefinitions = [openTask, otherTask];
    component.tasks = [];
    const selectedTaskDefinition$ = openTaskDefinition(component, openTask);

    component.searchText = 'P1';
    component.applyFilters();

    expect(component.filteredTaskDefinitions).toEqual([openTask]);
    expect(selectedTaskDefinition$.value).toBe(openTask);

    component.searchText = 'P2';
    component.applyFilters();

    expect(component.filteredTaskDefinitions).toEqual([otherTask]);
    expect(selectedTaskDefinition$.value).toBe(openTask);
  });

  it('drops the selection when a view filter hides the open task', () => {
    const passTask = taskDefinition(1, 'P1', undefined, 0);
    const creditTask = taskDefinition(2, 'C1', undefined, 1);
    component.project = studentProject();
    component.targetGrade = 0;
    component.taskDefinitions = [passTask, creditTask];
    component.tasks = [];
    component.toggleShowAboveTargetGrade(true);
    const selectedTaskDefinition$ = openTaskDefinition(component, creditTask);

    component.toggleShowAboveTargetGrade(false);

    expect(component.filteredTaskDefinitions).toEqual([passTask]);
    expect(selectedTaskDefinition$.value).toBeNull();
  });

  it('drops the selection when the open task leaves the task definitions', () => {
    const passTask = taskDefinition(1, 'P1');
    const removedTask = taskDefinition(2, 'P2');
    component.project = studentProject();
    component.targetGrade = 0;
    component.taskDefinitions = [passTask, removedTask];
    component.tasks = [];
    const selectedTaskDefinition$ = openTaskDefinition(component, removedTask);

    component.taskDefinitions = [passTask];
    component.applyFilters();

    expect(selectedTaskDefinition$.value).toBeNull();
  });

  it('badges the filter button while tasks beyond the target grade are hidden', () => {
    component.project = studentProject();
    component.targetGrade = 0;
    component.taskDefinitions = [taskDefinition(1, 'P1')];
    component.tasks = [];

    component.applyFilters();

    expect(component.hidingTasksAboveTargetGrade).toBe(true);
    expect(component.activeViewPreferenceCount).toBe(1);
    expect(component.hasNonDefaultViewPreferences).toBe(false);

    component.toggleShowAboveTargetGrade(true);

    expect(component.hidingTasksAboveTargetGrade).toBe(false);
    expect(component.activeViewPreferenceCount).toBe(0);
    expect(component.hasNonDefaultViewPreferences).toBe(true);
  });

  it('does not badge target-grade hiding on an all-tasks list', () => {
    component.mode = 'all-tasks';
    component.taskDefinitions = [taskDefinition(1, 'P1')];
    component.tasks = [];

    component.applyFilters();

    expect(component.activeViewPreferenceCount).toBe(0);
  });

  it('still shows a task beyond the target grade when it has unread comments', () => {
    const passTask = taskDefinition(1, 'P1', undefined, 0);
    const creditTask = taskDefinition(2, 'C1', undefined, 1);
    const distinctionTask = taskDefinition(3, 'D1', undefined, 2);
    component.project = studentProject();
    component.targetGrade = 0;
    component.taskDefinitions = [passTask, creditTask, distinctionTask];
    component.tasks = [
      taskForDefinition(creditTask, 2, 3),
      taskForDefinition(distinctionTask, 3, 0),
    ];

    component.applyFilters();

    expect(component.filteredTaskDefinitions).toEqual([passTask, creditTask]);
  });
});
