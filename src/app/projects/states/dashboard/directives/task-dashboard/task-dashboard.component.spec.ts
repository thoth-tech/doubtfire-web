import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatMenuModule} from '@angular/material/menu';
import {ActivatedRoute} from '@angular/router';
import {BehaviorSubject} from 'rxjs';
import {Project, Task, User} from 'src/app/api/models/doubtfire-model';
import {TaskService} from 'src/app/api/services/task.service';
import {UserService} from 'src/app/api/services/user.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
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
      imports: [MatMenuModule],
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
    } as unknown as Task;
    component.currentView = DashboardViews.details;
    component.currentIndex = 0;
    userServiceStub.currentUser = student;

    fixture.detectChanges();

    const details = fixture.nativeElement.querySelector('.flex.flex-col.gap-3.p-3');
    const children = Array.from(details.children) as HTMLElement[];
    const submissionIndex = children.findIndex(
      (element) => element.tagName.toLowerCase() === 'f-task-submission-card',
    );
    const peerProgressIndex = children.findIndex(
      (element) => element.tagName.toLowerCase() === 'f-ppi-widget',
    );

    expect(submissionIndex).toBeGreaterThan(-1);
    expect(peerProgressIndex).toBe(submissionIndex + 1);
  });
});
