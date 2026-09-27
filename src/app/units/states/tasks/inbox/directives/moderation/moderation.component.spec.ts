import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatIconModule} from '@angular/material/icon';
import {provideRouter} from '@angular/router';
import {Task} from 'src/app/api/models/task';
import {AlertService} from 'src/app/common/services/alert.service';
import {ConfirmModerationModalService} from './confirm-moderation-modal/confirm-moderation-modal.service';
import {ModerationComponent} from './moderation.component';

describe('ModerationComponent action names', () => {
  let fixture: ComponentFixture<ModerationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModerationComponent],
      imports: [MatIconModule],
      providers: [
        provideRouter([]),
        {provide: AlertService, useValue: {}},
        {provide: ConfirmModerationModalService, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(ModerationComponent);
  });

  it.each([
    [
      'random_sample',
      [
        'Show more from this tutor',
        'Snooze this task',
        'Dismiss from moderation',
        'Show less from this tutor',
      ],
    ],
    ['escalation', ['Overturn the outcome', 'Uphold the outcome']],
  ])(
    'names the %s actions on the buttons rather than the hidden icons',
    (moderationType, labels) => {
      fixture.componentRef.setInput('task', {moderationType} as Task);
      fixture.detectChanges();
      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      );
      expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(labels);
      expect(
        buttons.every(
          (button) => button.querySelector('mat-icon')?.getAttribute('aria-hidden') === 'true',
        ),
      ).toBe(true);
    },
  );

  it('retains the action names after moderation disables the buttons', () => {
    const task = {moderationType: 'escalation'} as Task;
    fixture.componentRef.setInput('task', task);
    fixture.componentInstance.moderated.set(task, true);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    expect(buttons.every((button) => button.disabled && !!button.getAttribute('aria-label'))).toBe(
      true,
    );
    expect(buttons).toHaveLength(2);
  });
});
