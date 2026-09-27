import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Task} from 'src/app/api/models/task';
import {Unit} from 'src/app/api/models/unit';
import {UnitRole} from 'src/app/api/models/unit-role';
import {User} from 'src/app/api/models/user/user';
import {TaskService} from 'src/app/api/services/task.service';
import {UserService} from 'src/app/api/services/user.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {TaskClaimComponent} from './task-claim.component';

function claimedTask(claimedByUnitRoleId: number | null): Task {
  const unit = new Unit();
  const unitRole = new UnitRole();
  unitRole.id = 10;
  unitRole.user = {id: 1} as User;
  unit.staffCache.add(unitRole);

  const task = new Task(unit);
  task.claimedByUnitRoleId = claimedByUnitRoleId;
  return task;
}

describe('TaskClaimComponent', () => {
  let component: TaskClaimComponent;
  let fixture: ComponentFixture<TaskClaimComponent>;
  let currentUser: User;

  beforeEach(async () => {
    currentUser = {id: 1} as User;

    await TestBed.configureTestingModule({
      declarations: [TaskClaimComponent],
      providers: [
        {provide: TaskService, useValue: {}},
        {provide: AlertService, useValue: {}},
        {provide: MatSnackBar, useValue: {}},
        {
          provide: UserService,
          useValue: {
            get currentUser() {
              return currentUser;
            },
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(TaskClaimComponent, {set: {template: ''}})
      .compileComponents();

    fixture = TestBed.createComponent(TaskClaimComponent);
    component = fixture.componentInstance;
  });

  it('knows the task is yours when your role holds the claim', () => {
    component.selectedTask = claimedTask(10);

    expect(component.claimedByMe).toBe(true);
  });

  // The template read currentUnitRole.id straight off, so an admin with no role in the
  // unit could not open a claimed overflow task.
  it('treats a claimed task as someone else’s when you have no role in the unit', () => {
    currentUser = {id: 99} as User;
    component.selectedTask = claimedTask(10);

    expect(() => component.claimedByMe).not.toThrow();
    expect(component.claimedByMe).toBe(false);
  });

  it('is not yours when nobody has claimed it', () => {
    component.selectedTask = claimedTask(null);

    expect(component.claimedByMe).toBe(false);
  });
});
