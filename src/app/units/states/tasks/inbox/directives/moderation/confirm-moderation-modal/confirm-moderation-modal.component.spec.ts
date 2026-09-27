import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {Task} from 'src/app/api/models/task';
import {TaskService} from 'src/app/api/services/task.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {ConfirmModerationModalComponent} from './confirm-moderation-modal.component';
import {ConfirmModerationModalData} from './confirm-moderation-modal.service';

describe('ConfirmModerationModalComponent', () => {
  let fixture: ComponentFixture<ConfirmModerationModalComponent>;
  let component: ConfirmModerationModalComponent;
  let data: ConfirmModerationModalData;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    close = vi.fn();
    data = {
      task: {
        tutor: undefined,
        definition: {abbreviation: '1.1P', name: 'Hello'},
      } as unknown as Task,
      title: 'Snooze task',
      description: 'Hidden until the tutor leaves new feedback.',
      action: 'snooze',
      showDismissAll: false,
      callback: vi.fn(),
    };

    await TestBed.configureTestingModule({
      declarations: [ConfirmModerationModalComponent],
      providers: [
        {provide: MatDialogRef, useValue: {close}},
        {provide: MAT_DIALOG_DATA, useFactory: () => data},
        {provide: AlertService, useValue: {}},
        {provide: TaskService, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmModerationModalComponent);
    component = fixture.componentInstance;
  });

  // The title line read task.tutor.user.name and threw for a student with no tutor, so
  // the dialog opened blank and the task could not be moderated.
  it('opens for a task with no tutor', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(component.tutorName).toBe('not assigned');
    expect(fixture.nativeElement.textContent).toContain('Tutor: not assigned');
  });

  it('shows an icon for every moderation action, snooze included', () => {
    fixture.detectChanges();

    expect(component.actionIcon).toBe('snooze');
  });

  it('runs the action and closes when confirmed', () => {
    fixture.detectChanges();
    component.runCallback();

    expect(data.callback).toHaveBeenCalledWith(false);
    expect(close).toHaveBeenCalled();
  });
});
