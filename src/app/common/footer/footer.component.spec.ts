import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CommonModule} from '@angular/common';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatMenuModule} from '@angular/material/menu';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {BehaviorSubject} from 'rxjs';
import {Task} from 'src/app/api/models/task';
import {Unit} from 'src/app/api/models/unit';
import {UnitRole} from 'src/app/api/models/unit-role';
import {User} from 'src/app/api/models/user/user';
import {ProjectService} from 'src/app/api/services/project.service';
import {TaskService} from 'src/app/api/services/task.service';
import {UserService} from 'src/app/api/services/user.service';
import {SelectedTaskService} from 'src/app/projects/states/dashboard/selected-task.service';
import {FileDownloaderService} from '../file-downloader/file-downloader.service';
import {ConfirmationModalService} from '../modals/confirmation-modal/confirmation-modal.service';
import {DiscussedInClassReasonModalService} from '../modals/discussed-in-class-reason-modal/discussed-in-class-reason-modal.service';
import {TaskAssessmentModalService} from '../modals/task-assessment-modal/task-assessment-modal.service';
import {ProjectProgressBarComponent} from '../project-progress-bar/project-progress-bar.component';
import {AlertService} from '../services/alert.service';
import {FooterComponent} from './footer.component';

const emptyProvider = {};

function staffedUnit(...roles: {id: number; userId: number}[]): Unit {
  const unit = new Unit();
  for (const {id, userId} of roles) {
    const unitRole = new UnitRole();
    unitRole.id = id;
    unitRole.user = {id: userId} as User;
    unit.staffCache.add(unitRole);
  }
  return unit;
}

function taskIn(unit: Unit, claimedByUnitRoleId: number | null = null): Task {
  const task = new Task(unit);
  task.claimedByUnitRoleId = claimedByUnitRoleId;
  return task;
}

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;
  let currentUser: User | null;

  let selectedTask: BehaviorSubject<Task>;

  beforeEach(async () => {
    currentUser = {id: 1} as User;
    selectedTask = new BehaviorSubject<Task>({
      definition: {assessInPortfolioOnly: false},
      project: {},
      suggestedTaskStatus: 'redo',
      canMarkComplete: false,
      updateTaskStatus: vi.fn(),
      hasReadyForFeedbackDependents: vi.fn().mockResolvedValue(false),
    } as unknown as Task);

    await TestBed.configureTestingModule({
      declarations: [FooterComponent, ProjectProgressBarComponent],
      imports: [CommonModule, MatMenuModule, MatProgressBarModule],
      providers: [
        {provide: SelectedTaskService, useValue: {selectedTask$: selectedTask}},
        {
          provide: TaskService,
          useValue: {
            statusData: (status: string) => ({
              label: status === 'redo' ? 'Redo' : 'Complete',
              materialIcon: 'done',
              class: '',
            }),
          },
        },
        {provide: FileDownloaderService, useValue: emptyProvider},
        {provide: TaskAssessmentModalService, useValue: emptyProvider},
        {
          provide: UserService,
          useValue: {
            get currentUser() {
              return currentUser;
            },
          },
        },
        {provide: ProjectService, useValue: emptyProvider},
        {provide: ConfirmationModalService, useValue: emptyProvider},
        {provide: DiscussedInClassReasonModalService, useValue: emptyProvider},
        {provide: AlertService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    component.viewType = 'inbox';
    fixture.detectChanges();
  });

  it('names grading actions and keeps the names connected to the correct status changes', async () => {
    const redo: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[aria-label="Mark as Redo"]',
    );
    const resubmit: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[aria-label="Mark as Resubmit"]',
    );
    redo.click();
    resubmit.click();
    await fixture.whenStable();
    expect(selectedTask.value.updateTaskStatus).toHaveBeenCalledWith('redo');
    expect(selectedTask.value.updateTaskStatus).toHaveBeenCalledWith('fix_and_resubmit');
  });

  it('updates the recommended action name when its status changes', () => {
    const recommended: HTMLButtonElement =
      fixture.nativeElement.querySelector('.suggested-task-status');
    expect(recommended.getAttribute('aria-label')).toBe('Recommended: Mark as Redo');
    selectedTask.next({...selectedTask.value, suggestedTaskStatus: 'complete'} as Task);
    fixture.detectChanges();
    expect(recommended.getAttribute('aria-label')).toBe('Recommended: Mark as Complete');
    expect(recommended.disabled).toBe(true);
  });

  it('keeps unavailable file and status controls named without a selected task', () => {
    selectedTask.next(undefined);
    fixture.detectChanges();
    for (const label of [
      'Mark as Redo',
      'Mark as Resubmit',
      'More statuses',
      'Download the submitted files',
      'Download the submission PDF',
    ]) {
      const button: HTMLButtonElement = fixture.nativeElement.querySelector(
        `[aria-label="${label}"]`,
      );
      expect(button).not.toBeNull();
      expect(button.disabled).toBe(true);
    }
    expect(fixture.nativeElement.querySelector('f-user-badge')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="progressbar"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('mat-chip-listbox')).toBeNull();
  });

  it('shows the selected project target as text rather than a selection control', () => {
    selectedTask.next({
      ...selectedTask.value,
      project: {
        targetGradeWord: 'Pass',
        targetGradeAcronym: 'P',
        taskStats: [{value: 0}, {value: 0}, {value: 0}, {value: 0}, {value: 42}],
      },
    } as Task);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Target grade: Pass');
    expect(fixture.nativeElement.querySelector('mat-chip-option, [role="listbox"]')).toBeNull();
    const progress = fixture.nativeElement.querySelector('[role="progressbar"]');
    expect(progress.getAttribute('aria-label')).toBe('Project progress towards target grade');
    expect(progress.getAttribute('aria-valuenow')).toBe('42');
  });

  it('names the moderation action menu', () => {
    component.viewType = 'moderation';
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector(
        '[aria-label="Switch between moderation and status buttons"]',
      ),
    ).not.toBeNull();
  });

  it('has no staff role and no tutor notes before a task is selected', () => {
    component.selectedTask = null;

    expect(component.currentUnitRole).toBeUndefined();
    expect(component.canAccessTutorNotes).toBe(false);
    expect(component.actionButtonEnabled).toBe(false);
  });

  // An admin can open the overflow queue without holding a role in the unit, and the
  // bar used to throw reading the id of that missing role.
  it('keeps the marking buttons off, without throwing, for someone with no role in the unit', () => {
    currentUser = {id: 99} as User;
    component.viewType = 'overflow';
    component.selectedTask = taskIn(staffedUnit({id: 10, userId: 1}));

    expect(() => component.actionButtonEnabled).not.toThrow();
    expect(component.actionButtonEnabled).toBe(false);
  });

  it('turns the marking buttons on for the tutor who claimed the task', () => {
    component.viewType = 'overflow';
    component.selectedTask = taskIn(staffedUnit({id: 10, userId: 1}), 10);

    expect(component.actionButtonEnabled).toBe(true);
  });

  it('keeps the marking buttons off when another tutor holds the claim', () => {
    component.viewType = 'inbox';
    component.selectedTask = taskIn(staffedUnit({id: 10, userId: 1}, {id: 11, userId: 2}), 11);

    expect(component.actionButtonEnabled).toBe(false);
  });

  // The "must be discussed in class" tooltip used to show with no task selected at all.
  it('gives a reason for Complete being off only when discussion is the reason', () => {
    component.selectedTask = null;
    expect(component.completeBlockedReason).toBe('');

    const task = taskIn(staffedUnit({id: 10, userId: 1}));
    task.definition = {requiresDiscussion: true} as Task['definition'];
    component.selectedTask = task;
    expect(component.completeBlockedReason).toBe(
      'Discuss this task in class before marking it complete',
    );

    task.definition = {requiresDiscussion: false} as Task['definition'];
    expect(component.completeBlockedReason).toBe('');
  });

  it('describes the student’s progress, or says it is unavailable', () => {
    component.selectedTask = null;
    expect(component.progressLabel).toBe('Progress unavailable');

    const task = taskIn(staffedUnit({id: 10, userId: 1}));
    task.project = {
      taskStats: [0, 1, 2, 3, 4].map((value) => ({key: 'complete', value: value * 10})),
      targetGradeWord: 'Distinction',
    } as unknown as Task['project'];
    component.selectedTask = task;

    expect(component.progressLabel).toBe('40% progress towards Distinction');
  });
});
