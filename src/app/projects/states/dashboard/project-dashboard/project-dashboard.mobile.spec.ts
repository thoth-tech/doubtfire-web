import {beforeEach, describe, expect, it, vi} from 'vitest';
import {BreakpointObserver, BreakpointState} from '@angular/cdk/layout';
import {CommonModule} from '@angular/common';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router, convertToParamMap} from '@angular/router';
import {BehaviorSubject, Subject, of, tap} from 'rxjs';
import {Project, Task, TaskDefinition, Unit} from 'src/app/api/models/doubtfire-model';
import {ProjectService} from 'src/app/api/services/project.service';
import {TaskService} from 'src/app/api/services/task.service';
import {UnitService} from 'src/app/api/services/unit.service';
import {UserService} from 'src/app/api/services/user.service';
import {GlobalStateService} from '../../index/global-state.service';
import {ProjectDashboardComponent} from './project-dashboard.component';

describe('ProjectDashboardComponent phone task workspace', () => {
  let fixture: ComponentFixture<ProjectDashboardComponent>;
  let component: ProjectDashboardComponent;
  let phoneState$: BehaviorSubject<BreakpointState>;
  let commentsState$: BehaviorSubject<BreakpointState>;
  let observeBreakpoint: ReturnType<typeof vi.fn>;
  let routeTaskAbbreviation: string | null;
  let routeMobilePane: string | null;
  let routeParams$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let routerNavigate: ReturnType<typeof vi.fn>;

  const taskDefinition = {
    id: 42,
    abbreviation: '1.1P',
    name: 'First task',
  } as TaskDefinition;
  const unit = {
    id: 101,
    taskDefinitions: [taskDefinition],
    studentCache: {add: vi.fn()},
  } as unknown as Unit;
  const task = {definition: taskDefinition, numNewComments: 1} as Task;
  const project = {
    id: 2,
    targetGrade: 0,
    unit,
    tasks: [task],
    findTaskForDefinition: (id: number) => (id === taskDefinition.id ? task : null),
  } as unknown as Project;

  const renderSelectedTask = (): void => {
    component.selectedTaskDefinition$.next(taskDefinition);
    fixture.detectChanges();
  };

  const query = <T extends Element = HTMLElement>(selector: string): T | null =>
    fixture.nativeElement.querySelector(selector) as T | null;

  beforeEach(async () => {
    routeTaskAbbreviation = null;
    routeMobilePane = null;
    routeParams$ = new BehaviorSubject(convertToParamMap({}));
    routerNavigate = vi.fn().mockResolvedValue(true);
    task.numNewComments = 1;
    phoneState$ = new BehaviorSubject<BreakpointState>({
      matches: true,
      breakpoints: {},
    });
    commentsState$ = new BehaviorSubject<BreakpointState>({
      matches: true,
      breakpoints: {},
    });
    observeBreakpoint = vi.fn((value: string | readonly string[]) => {
      const queryText = Array.isArray(value) ? value.join(',') : value;
      return queryText.includes('999.98px') ? commentsState$ : phoneState$;
    });

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [ProjectDashboardComponent],
      providers: [
        {provide: UserService, useValue: {}},
        {
          provide: ProjectService,
          useValue: {
            get: (
              _params: {id: number},
              options: {mappingCompleteCallback: (loaded: Project) => void},
            ) => of(project).pipe(tap((loaded) => options.mappingCompleteCallback(loaded))),
          },
        },
        {
          provide: TaskService,
          useValue: {taskSubmissionCompleted$: new Subject<Task>()},
        },
        {provide: UnitService, useValue: {get: () => of(unit)}},
        {provide: GlobalStateService, useValue: {setView: vi.fn()}},
        {
          provide: ActivatedRoute,
          useFactory: () => ({
            paramMap: routeParams$.asObservable(),
            snapshot: {
              get paramMap() {
                return convertToParamMap({
                  taskAbbreviation: routeTaskAbbreviation,
                  mobilePane: routeMobilePane,
                });
              },
            },
            parent: {
              data: of({project}),
              snapshot: {
                data: {project},
                paramMap: convertToParamMap({projectId: project.id}),
              },
            },
          }),
        },
        {provide: BreakpointObserver, useValue: {observe: observeBreakpoint}},
        {provide: Router, useValue: {navigate: routerNavigate}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  const createComponent = (): void => {
    routeParams$.next(
      convertToParamMap({
        taskAbbreviation: routeTaskAbbreviation,
        mobilePane: routeMobilePane,
      }),
    );
    fixture = TestBed.createComponent(ProjectDashboardComponent);
    component = fixture.componentInstance;
    component.project$ = of(project);
    fixture.detectChanges();
  };

  it('uses a single full-width feedback pane for a task opened from a phone deep link', () => {
    routeTaskAbbreviation = taskDefinition.abbreviation;
    createComponent();
    renderSelectedTask();

    expect(observeBreakpoint).toHaveBeenCalledWith('(max-width: 639.98px)');
    expect(component.isPhoneLayout).toBe(true);
    expect(component.mobilePane).toBe('feedback');
    expect(query('.project-task-list-panel')?.classList).toContain(
      'project-task-list-panel--phone-hidden',
    );
    expect(query('.project-task-resizer')?.classList).toContain(
      'project-task-resizer--phone-hidden',
    );
    expect(query('.mobile-task-view')).not.toBeNull();
    expect(query('.mobile-task-pane task-comments-viewer')).not.toBeNull();
    expect(query('.mobile-task-pane f-task-dashboard')).toBeNull();
    expect(query('.comments-sidebar')).toBeNull();
  });

  it('keeps project navigation visible while the phone task list is open', () => {
    createComponent();

    const overviewButton = query<HTMLButtonElement>('button[aria-label="Show project overview"]');
    const taskListButton = query<HTMLButtonElement>('button[aria-label="Show task list"]');
    const detailsButton = query<HTMLButtonElement>('button[aria-label="Show task details"]');
    const feedbackButton = query<HTMLButtonElement>('button[aria-label="Show feedback"]');

    expect(query('nav[aria-label="Project dashboard navigation"]')).not.toBeNull();
    expect(overviewButton?.getAttribute('aria-pressed')).toBe('false');
    expect(taskListButton?.getAttribute('aria-pressed')).toBe('true');
    expect(taskListButton?.classList).toContain('mobile-task-tab--active');
    expect(detailsButton?.disabled).toBe(true);
    expect(feedbackButton?.disabled).toBe(true);
    expect(query('.project-task-list-panel')?.classList).not.toContain(
      'project-task-list-panel--phone-hidden',
    );
  });

  it('exposes the complete progress dashboard from the phone overview tab', () => {
    createComponent();

    query<HTMLButtonElement>('button[aria-label="Show project overview"]')?.click();
    fixture.detectChanges();

    const overviewButton = query<HTMLButtonElement>('button[aria-label="Show project overview"]');
    expect(component.mobilePane).toBe('overview');
    expect(overviewButton?.getAttribute('aria-pressed')).toBe('true');
    expect(overviewButton?.classList).toContain('mobile-task-tab--active');
    expect(query('section[aria-label="Project overview"]')).not.toBeNull();
    expect(query('.mobile-overview-pane f-progress-dashboard')).not.toBeNull();
    expect(query('.project-task-list-panel')?.classList).toContain(
      'project-task-list-panel--phone-hidden',
    );
    expect(query('.mobile-task-view')).toBeNull();
  });

  it('keeps the selected task available while viewing progress on a phone', () => {
    createComponent();
    renderSelectedTask();

    query<HTMLButtonElement>('button[aria-label="Show project overview"]')?.click();
    fixture.detectChanges();

    expect(component.selectedTaskDefinition$.value).toBe(taskDefinition);
    expect(query('.mobile-overview-pane f-progress-dashboard')).not.toBeNull();

    query<HTMLButtonElement>('button[aria-label="Show feedback"]')?.click();
    fixture.detectChanges();

    expect(component.selectedTaskDefinition$.value).toBe(taskDefinition);
    expect(component.mobilePane).toBe('feedback');
    expect(query('.mobile-task-pane task-comments-viewer')).not.toBeNull();
    expect(query('.mobile-overview-pane')).toBeNull();
  });

  it('opens task details first when a student selects a task from the phone list', () => {
    createComponent();
    renderSelectedTask();

    expect(component.mobilePane).toBe('task');
    expect(query('.mobile-task-pane f-task-dashboard')).not.toBeNull();
    expect(query('.mobile-task-pane task-comments-viewer')).toBeNull();
  });

  it('switches exclusively between the task and feedback panes', () => {
    createComponent();
    renderSelectedTask();

    const feedbackButton = query<HTMLButtonElement>('button[aria-label="Show feedback"]');
    feedbackButton?.click();
    fixture.detectChanges();

    expect(
      query<HTMLButtonElement>('button[aria-label="Show feedback"]')?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(query('.mobile-task-pane task-comments-viewer')).not.toBeNull();
    expect(query('.mobile-task-pane f-task-dashboard')).toBeNull();

    const detailsButton = query<HTMLButtonElement>('button[aria-label="Show task details"]');
    detailsButton?.click();
    fixture.detectChanges();

    expect(
      query<HTMLButtonElement>('button[aria-label="Show task details"]')?.getAttribute(
        'aria-pressed',
      ),
    ).toBe('true');
    expect(query('.mobile-task-pane f-task-dashboard')).not.toBeNull();
    expect(query('.mobile-task-pane task-comments-viewer')).toBeNull();
  });

  it('keeps a non-feedback deep link on task details when there are no unread comments', () => {
    routeTaskAbbreviation = taskDefinition.abbreviation;
    task.numNewComments = 0;
    createComponent();
    renderSelectedTask();

    expect(component.mobilePane).toBe('task');
    expect(query('.mobile-task-pane f-task-dashboard')).not.toBeNull();
    expect(query('.mobile-task-pane task-comments-viewer')).toBeNull();
  });

  it('opens an explicit feedback destination even after its comments were already read', () => {
    routeTaskAbbreviation = taskDefinition.abbreviation;
    routeMobilePane = 'feedback';
    task.numNewComments = 0;
    createComponent();
    renderSelectedTask();

    expect(component.mobilePane).toBe('feedback');
    expect(query('.mobile-task-pane task-comments-viewer')).not.toBeNull();
    expect(query('.mobile-task-pane f-task-dashboard')).toBeNull();
  });

  it('reopens feedback when the same task receives another notification after changing panes', () => {
    routeTaskAbbreviation = taskDefinition.abbreviation;
    routeMobilePane = 'feedback';
    task.numNewComments = 0;
    createComponent();
    renderSelectedTask();

    query<HTMLButtonElement>('button[aria-label="Show project overview"]')?.click();
    fixture.detectChanges();

    expect(component.mobilePane).toBe('overview');
    expect(routerNavigate).toHaveBeenLastCalledWith(
      ['/projects', project.id, 'dashboard', taskDefinition.abbreviation],
      {replaceUrl: true},
    );

    routeMobilePane = null;
    routeParams$.next(convertToParamMap({taskAbbreviation: taskDefinition.abbreviation}));
    routeMobilePane = 'feedback';
    routeParams$.next(
      convertToParamMap({
        taskAbbreviation: taskDefinition.abbreviation,
        mobilePane: routeMobilePane,
      }),
    );
    fixture.detectChanges();

    expect(component.mobilePane).toBe('feedback');
    expect(query('.mobile-task-pane task-comments-viewer')).not.toBeNull();
    expect(query('.mobile-overview-pane')).toBeNull();
  });

  it('returns to the full-width task list from the selected phone workspace', () => {
    createComponent();
    renderSelectedTask();

    const clearThroughTaskList = vi.fn(() => component.selectedTaskDefinition$.next(null));
    Reflect.set(component, 'leftPanel', {setSelectedTaskDefinition: clearThroughTaskList});

    query<HTMLButtonElement>('button[aria-label="Show task list"]')?.click();
    fixture.detectChanges();

    expect(clearThroughTaskList).toHaveBeenCalledWith(taskDefinition);
    expect(component.selectedTaskDefinition$.value).toBeNull();
    expect(component.mobilePane).toBe('task');
    expect(query('.mobile-task-view')).toBeNull();
    expect(query('nav[aria-label="Project dashboard navigation"]')).not.toBeNull();
    expect(
      query<HTMLButtonElement>('button[aria-label="Show task list"]')?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(query('.project-task-list-panel')?.classList).not.toContain(
      'project-task-list-panel--phone-hidden',
    );
  });

  it('preserves the three-pane desktop layout above the phone breakpoint', () => {
    phoneState$.next({matches: false, breakpoints: {}});
    commentsState$.next({matches: false, breakpoints: {}});
    createComponent();
    renderSelectedTask();

    expect(component.isPhoneLayout).toBe(false);
    expect(query('.mobile-task-view')).toBeNull();
    expect(query('.desktop-task-dashboard f-task-dashboard')).not.toBeNull();
    expect(query('.comments-sidebar task-comments-viewer')).not.toBeNull();
    expect(query<HTMLElement>('.project-task-list-panel')?.style.width).toBe('400px');
  });
});
