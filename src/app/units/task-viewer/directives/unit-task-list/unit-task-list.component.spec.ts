import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Directive, NO_ERRORS_SCHEMA, SimpleChange} from '@angular/core';
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

// A11Y-COLOUR03. The TaskStatusBadges template is what the dashboard and the
// task viewer draw next to every task, and each badge is the only signal a
// student gets that a task has new comments, similarities or a deadline state.
// MatIcon hides the glyph and a tooltip is not a name for a non-interactive
// element, so without a role and label a screen reader got nothing, or a bare
// number for the comment count. These tests render the real template because
// what assistive technology reads is a question about the markup. StubMatMenu
// satisfies `#taskListFiltersMenu="matMenu"` in the filter menu, and
// NO_ERRORS_SCHEMA renders the other mat-* elements as plain markup.
@Directive({selector: 'mat-menu', exportAs: 'matMenu', standalone: false})
class StubMatMenu {}

describe('FUnitTaskListComponent task status badges', () => {
  let fixture: ComponentFixture<FUnitTaskListComponent>;

  const badgeTaskDefinition = {
    ...taskDefinition(1, '1.1P'),
    isGroupTask: () => false,
  } as unknown as TaskDefinition;

  // Every badge condition starts off, so each test turns on only the state it
  // is about. Only the members the template reads are present.
  const makeTask = (overrides: Record<string, unknown> = {}): Task =>
    ({
      definition: badgeTaskDefinition,
      status: 'not_started',
      numNewComments: 0,
      similaritiesDetected: false,
      qualityPts: 0,
      hasGrade: () => false,
      gradeDesc: () => '',
      hasQualityPoints: () => false,
      isDueSoon: () => false,
      betweenDueDateAndDeadlineDate: () => false,
      isPastDeadline: () => false,
      inFinalState: () => false,
      isBeforeStartDate: () => false,
      inSubmittedState: () => false,
      daysUntilDueDate: () => 20,
      timeToDue: () => '',
      localDueDate: (): Date => undefined,
      ...overrides,
    }) as unknown as Task;

  const render = (task: Task, isCollapsed = false): void => {
    fixture = TestBed.createComponent(FUnitTaskListComponent);
    const component = fixture.componentInstance;
    component.mode = 'all-tasks';
    component.isCollapsed = isCollapsed;
    component.taskDefinitions = [badgeTaskDefinition];
    component.tasks = [task];
    component.selectedTaskDefinition$ = new BehaviorSubject<TaskDefinition>(null);
    fixture.detectChanges();
  };

  const badges = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[role="img"]'));

  const labels = (): string[] => badges().map((badge) => badge.getAttribute('aria-label'));

  beforeEach(async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });

    await TestBed.configureTestingModule({
      declarations: [FUnitTaskListComponent, StubMatMenu],
      providers: [
        {provide: Router, useValue: emptyProvider},
        {
          provide: ActivatedRoute,
          useValue: {paramMap: new Subject<ReturnType<typeof convertToParamMap>>()},
        },
      ],
      // The real template is rendered on purpose: the fix is in the markup.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  afterEach(() => vi.unstubAllGlobals());

  // The last column is how many glyphs the badge draws. The comment badge draws
  // only its count, and the past deadline badge adds a "!" after its icon.
  it.each([
    ['one new comment', {numNewComments: 1}, '1 new comment', 0],
    ['several new comments', {numNewComments: 3}, '3 new comments', 0],
    ['similarities', {similaritiesDetected: true}, 'Similarities Detected', 1],
    ['due soon', {isDueSoon: () => true}, 'Due soon', 1],
    [
      'due before the deadline',
      {betweenDueDateAndDeadlineDate: () => true},
      'Due, deadline not yet passed',
      1,
    ],
    ['past deadline', {isPastDeadline: () => true}, 'Past deadline', 2],
  ])('names the %s badge and hides its glyph', (_name, overrides, label, glyphCount) => {
    render(makeTask(overrides));

    expect(labels()).toEqual([label]);

    const glyphs: HTMLElement[] = Array.from(badges()[0].querySelectorAll('mat-icon, strong'));
    expect(glyphs).toHaveLength(glyphCount);
    glyphs.forEach((glyph) => expect(glyph.getAttribute('aria-hidden')).toBe('true'));
  });

  // MatTooltip only skips adding aria-describedby when the tooltip text is
  // exactly the aria-label, so any difference makes a screen reader say it twice.
  it('gives the similarities badge the same label as its tooltip', () => {
    render(makeTask({similaritiesDetected: true}));

    const [badge] = badges();
    expect(badge.getAttribute('aria-label')).toBe(badge.getAttribute('mattooltip'));
  });

  it('keeps the visible comment count as the bare number', () => {
    render(makeTask({numNewComments: 4}));

    expect(badges()[0].textContent.trim()).toBe('4');
    expect(labels()).toEqual(['4 new comments']);
  });

  it('uses a different glyph for past deadline than for due, so colour is not the only signal', () => {
    render(makeTask({betweenDueDateAndDeadlineDate: () => true}));
    const dueGlyph = badges()[0].querySelector('mat-icon').textContent.trim();

    render(makeTask({isPastDeadline: () => true}));
    const pastDeadlineGlyph = badges()[0].querySelector('mat-icon').textContent.trim();

    expect(dueGlyph).toBe('schedule');
    expect(pastDeadlineGlyph).toBe('event_busy');
  });

  it('names the badges in the collapsed list as well', () => {
    render(makeTask({numNewComments: 2, isDueSoon: () => true}), true);

    expect(labels()).toEqual(['2 new comments', 'Due soon']);
  });

  // Failure path: a badge whose condition is false is not rendered, so a
  // student is never told about a state that does not apply.
  it('renders no badges when nothing applies', () => {
    render(makeTask());

    expect(badges()).toEqual([]);
  });

  it('drops the deadline badges once the task is in a final state', () => {
    render(
      makeTask({
        isDueSoon: () => true,
        isPastDeadline: () => true,
        inFinalState: () => true,
      }),
    );

    expect(badges()).toEqual([]);
  });
});
