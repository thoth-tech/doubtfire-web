import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {Project, Task, User} from 'src/app/api/models/doubtfire-model';
import {TaskService} from 'src/app/api/services/task.service';
import {UserService} from 'src/app/api/services/user.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {SelectedTaskService} from '../../selected-task.service';
import {TaskDashboardComponent} from './task-dashboard.component';

const emptyProvider = {};

describe('TaskDashboardComponent', () => {
  let component: TaskDashboardComponent;
  let fixture: ComponentFixture<TaskDashboardComponent>;

  const userServiceStub: {currentUser?: User} = {};

  beforeEach(async () => {
    userServiceStub.currentUser = undefined;
    await TestBed.configureTestingModule({
      declarations: [TaskDashboardComponent],
      providers: [
        {provide: TaskService, useValue: emptyProvider},
        {provide: FileDownloaderService, useValue: emptyProvider},
        {provide: ActivatedRoute, useValue: emptyProvider},
        {provide: UserService, useValue: userServiceStub},
        {provide: SelectedTaskService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(TaskDashboardComponent, {set: {template: ''}})
      .compileComponents();
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

  it('hides peer progress when there is no current user', () => {
    const student = new User();
    student.id = 10;

    const project = new Project();
    project.student = student;

    component.task = new Task(project);
    userServiceStub.currentUser = undefined;

    expect(component.canViewPeerProgress).toBe(false);
  });
});
