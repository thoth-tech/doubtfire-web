import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {Project, TaskDefinition} from 'src/app/api/models/doubtfire-model';
import {TaskPrerequisite} from 'src/app/api/models/task-prerequisite';
import {TaskPlannerPrerequisitesModalComponent} from './task-planner-prerequisites-modal.component';
import {TaskPlannerPrerequisitesModalService} from './task-planner-prerequisites-modal.service';

describe('TaskPlannerPrerequisitesModalService', () => {
  let dialog: {open: ReturnType<typeof vi.fn>};
  let service: TaskPlannerPrerequisitesModalService;

  beforeEach(() => {
    dialog = {open: vi.fn()};
    TestBed.configureTestingModule({
      providers: [TaskPlannerPrerequisitesModalService, {provide: MatDialog, useValue: dialog}],
    });
    service = TestBed.inject(TaskPlannerPrerequisitesModalService);
  });

  it('opens the connection details within the phone viewport and restores launch focus', () => {
    const project = {id: 8} as Project;
    const taskDefinition = {id: 9} as TaskDefinition;
    const dependents = [{id: 10}] as TaskPrerequisite[];

    service.show(project, taskDefinition, dependents);

    expect(dialog.open).toHaveBeenCalledWith(TaskPlannerPrerequisitesModalComponent, {
      data: {taskDefinition, project, dependents},
      width: 'calc(100vw - 2rem)',
      maxWidth: '900px',
      maxHeight: 'calc(100dvh - 2rem)',
      autoFocus: 'dialog',
      restoreFocus: true,
      panelClass: 'task-connections-dialog-panel',
    });
  });
});
