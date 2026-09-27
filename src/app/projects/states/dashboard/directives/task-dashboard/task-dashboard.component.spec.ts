import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatMenuModule} from '@angular/material/menu';
import {ActivatedRoute} from '@angular/router';
import {BehaviorSubject, Subject} from 'rxjs';
import {Project, Task, User} from 'src/app/api/models/doubtfire-model';
import {TaskService} from 'src/app/api/services/task.service';
import {UserService} from 'src/app/api/services/user.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {PanelFullscreenButtonComponent} from 'src/app/common/panel-layout/panel-fullscreen-button.component';
import {PanelComponent} from 'src/app/common/panel-layout/panel.component';
import {DashboardViews, SelectedTaskService} from '../../selected-task.service';
import {TaskDashboardComponent} from './task-dashboard.component';

const emptyProvider = {};
const taskServiceStub = {
  markedStatuses: [],
  helpDescriptions: new Map(),
  statusIcons: new Map(),
  statusLabels: new Map(),
  statusClass: new Map(),
  statusSeq: new Map(),
  taskSubmissionCompleted$: new Subject<Task>(),
};
const selectedTaskServiceStub = {
  currentView$: new BehaviorSubject(DashboardViews.details),
};

describe('TaskDashboardComponent', () => {
  let component: TaskDashboardComponent;
  let fixture: ComponentFixture<TaskDashboardComponent>;

  const userServiceStub: {currentUser?: User} = {};

  beforeEach(async () => {
    userServiceStub.currentUser = undefined;
    await TestBed.configureTestingModule({
      declarations: [TaskDashboardComponent],
      imports: [MatMenuModule, PanelFullscreenButtonComponent],
      providers: [
        {provide: TaskService, useValue: taskServiceStub},
        {provide: FileDownloaderService, useValue: emptyProvider},
        {provide: ActivatedRoute, useValue: emptyProvider},
        {provide: UserService, useValue: userServiceStub},
        {provide: SelectedTaskService, useValue: selectedTaskServiceStub},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TaskDashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens Your Submission without losing the selected task after upload', () => {
    const project = new Project();
    project.id = 1;
    const task = new Task(project);
    task.definition = {
      id: 2,
      uploadRequirements: [{key: 'file0'}],
    } as unknown as Task['definition'];
    component.task = task;
    fixture.detectChanges();

    task.status = 'ready_for_feedback';
    task.submissionProcessingState = 'queued';
    taskServiceStub.taskSubmissionCompleted$.next(task);

    expect(component.currentView).toBe(DashboardViews.submission);
  });

  it('stays on Task Details when a task that takes no uploads is set Ready for Feedback', () => {
    const project = new Project();
    project.id = 1;
    const task = new Task(project);
    task.definition = {id: 2, uploadRequirements: []} as unknown as Task['definition'];
    component.task = task;
    fixture.detectChanges();

    task.status = 'ready_for_feedback';
    taskServiceStub.taskSubmissionCompleted$.next(task);

    expect(component.currentView).toBe(DashboardViews.details);
  });

  it('allows the project owner to view peer progress', () => {
    const student = new User();
    student.id = 10;

    const project = new Project();
    project.student = student;

    component.task = new Task(project);
    userServiceStub.currentUser = student;

    expect(component.canViewPeerProgress).toBe(true);
  });

  it('allows the project owner while the student relationship is still hydrating', () => {
    const student = new User();
    student.id = 10;

    const project = new Project();
    project.originalJson = {user_id: student.id};

    component.task = new Task(project);
    userServiceStub.currentUser = student;

    expect(project.student).toBeUndefined();
    expect(component.canViewPeerProgress).toBe(true);
  });

  it('does not allow another user to view peer progress', () => {
    const student = new User();
    student.id = 10;

    const otherUser = new User();
    otherUser.id = 20;

    const project = new Project();
    project.student = student;

    component.task = new Task(project);
    userServiceStub.currentUser = otherUser;

    expect(component.canViewPeerProgress).toBe(false);
  });

  it('hides peer progress when the project owner turns the profile preference off', () => {
    const student = new User();
    student.id = 10;
    student.displayPeerProgress = false;

    const project = new Project();
    project.student = student;

    component.task = new Task(project);
    userServiceStub.currentUser = student;

    expect(component.canViewPeerProgress).toBe(false);
  });

  it('preserves the project owner profile opt-out while the student relationship hydrates', () => {
    const student = new User();
    student.id = 10;
    student.displayPeerProgress = false;

    const project = new Project();
    project.originalJson = {user_id: student.id};

    component.task = new Task(project);
    userServiceStub.currentUser = student;

    expect(component.canViewPeerProgress).toBe(false);
  });

  it('does not use raw ownership data to override a hydrated student mismatch', () => {
    const currentUser = new User();
    currentUser.id = 10;

    const hydratedStudent = new User();
    hydratedStudent.id = 20;

    const project = new Project();
    project.student = hydratedStudent;
    project.originalJson = {user_id: currentUser.id};

    component.task = new Task(project);
    userServiceStub.currentUser = currentUser;

    expect(component.canViewPeerProgress).toBe(false);
  });

  it.each([undefined, null, '10', NaN, Infinity, 0, -10, 10.5])(
    'rejects malformed raw project ownership value %s',
    (rawUserId) => {
      const student = new User();
      student.id = 10;

      const project = new Project();
      project.originalJson = {user_id: rawUserId};

      component.task = new Task(project);
      userServiceStub.currentUser = student;

      expect(component.canViewPeerProgress).toBe(false);
    },
  );

  it('keeps peer progress on for a rolling API user without the new preference field', () => {
    const student = new User();
    student.id = 10;
    student.displayPeerProgress = undefined;

    const project = new Project();
    project.student = student;

    component.task = new Task(project);
    userServiceStub.currentUser = student;

    expect(component.canViewPeerProgress).toBe(true);
  });

  it('hides peer progress when there is no current user', () => {
    const student = new User();
    student.id = 10;

    const project = new Project();
    project.student = student;

    component.task = new Task(project);
    userServiceStub.currentUser = undefined;

    expect(component.canViewPeerProgress).toBe(false);
  });

  it('places the peer progress indicator after the submission panel in task details', () => {
    const student = new User();
    student.id = 10;
    student.displayPeerProgress = true;

    const project = new Project();
    project.student = student;

    component.task = {
      project,
      unit: {staff: []},
      definition: {hasTaskSheet: false, hasTaskResources: false},
      hasPdf: false,
      processingPdf: false,
      submissionProcessingActive: false,
      submissionPdfReady: false,
      submissionFilesReady: false,
      hasSubmissionHistory: () => false,
    } as unknown as Task;
    component.currentView = DashboardViews.details;
    component.currentIndex = 0;
    userServiceStub.currentUser = student;

    fixture.detectChanges();

    const details = fixture.nativeElement.querySelector('.flex.flex-col.gap-3.p-3');
    const shell = fixture.nativeElement.querySelector('.task-dashboard-shell');
    const body = fixture.nativeElement.querySelector('.task-dashboard-body');
    const children = Array.from(details.children) as HTMLElement[];
    const submissionIndex = children.findIndex(
      (element) => element.tagName.toLowerCase() === 'f-task-submission-card',
    );
    const peerProgressIndex = children.findIndex(
      (element) => element.tagName.toLowerCase() === 'f-ppi-widget',
    );

    expect(submissionIndex).toBeGreaterThan(-1);
    expect(peerProgressIndex).toBe(submissionIndex + 1);
    expect(shell.classList).toContain('task-dashboard-shell--document');
    expect(body.classList).toContain('task-dashboard-body--document');
  });

  it.each([DashboardViews.task, DashboardViews.submission])(
    'keeps bounded feature view %s out of phone document-flow flattening',
    (view) => {
      const project = new Project();
      component.task = {
        project,
        unit: {staff: []},
        definition: {hasTaskSheet: false},
        hasPdf: false,
        processingPdf: false,
        submissionProcessingActive: false,
        submissionPdfReady: false,
        submissionFilesReady: false,
        hasSubmissionHistory: () => false,
        blockedByPrerequisiteTasks: () => false,
      } as unknown as Task;
      fixture.detectChanges();

      component.setSelectedDashboardView(view);
      fixture.detectChanges();

      const shell = fixture.nativeElement.querySelector('.task-dashboard-shell');
      const body = fixture.nativeElement.querySelector('.task-dashboard-body');

      expect(shell.classList).not.toContain('task-dashboard-shell--document');
      expect(body.classList).not.toContain('task-dashboard-body--document');
    },
  );
});

describe('TaskDashboardComponent full screen', () => {
  let fixture: ComponentFixture<TaskDashboardComponent>;
  let panel: {
    panelTitle: string;
    isFullscreen: boolean;
    stacked: boolean;
    toggleFullscreen: ReturnType<typeof vi.fn>;
  };

  const task = () =>
    ({
      project: new Project(),
      unit: {staff: []},
      definition: {hasTaskSheet: false, hasTaskResources: false},
      hasPdf: false,
      processingPdf: false,
      submissionProcessingActive: false,
      submissionPdfReady: false,
      submissionFilesReady: false,
      hasSubmissionHistory: () => false,
      blockedByPrerequisiteTasks: () => false,
    }) as unknown as Task;

  beforeEach(async () => {
    panel = {
      panelTitle: 'Selected task',
      isFullscreen: false,
      stacked: false,
      toggleFullscreen: vi.fn(),
    };
    await TestBed.configureTestingModule({
      declarations: [TaskDashboardComponent],
      imports: [MatMenuModule, PanelFullscreenButtonComponent],
      providers: [
        {provide: TaskService, useValue: taskServiceStub},
        {provide: FileDownloaderService, useValue: emptyProvider},
        {provide: ActivatedRoute, useValue: emptyProvider},
        {provide: UserService, useValue: {}},
        {provide: SelectedTaskService, useValue: selectedTaskServiceStub},
        {provide: PanelComponent, useValue: panel},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskDashboardComponent);
    fixture.componentInstance.task = task();
    fixture.componentInstance.currentView = DashboardViews.details;
    fixture.detectChanges();
  });

  it('puts the full-screen button in the tab bar, just before the task actions menu', () => {
    const toggle = fixture.nativeElement.querySelector(
      'app-panel-fullscreen-button button',
    ) as HTMLButtonElement;

    expect(toggle.getAttribute('aria-label')).toBe('Open Selected task full screen');
    expect(toggle.classList).toContain('text-ot-muted');
    expect(
      toggle.closest('app-panel-fullscreen-button').nextElementSibling.getAttribute('aria-label'),
    ).toBe('Task actions');

    toggle.click();
    expect(panel.toggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it('keeps task details to a reading width only while full screen', () => {
    const details = () => fixture.nativeElement.querySelector('.task-details') as HTMLElement;
    expect(details().classList).not.toContain('dashboard-reading-measure');

    panel.isFullscreen = true;
    fixture.detectChanges();

    expect(details().classList).toContain('dashboard-reading-measure');
  });
});
