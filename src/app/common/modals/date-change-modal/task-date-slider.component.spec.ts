import {beforeEach, describe, expect, it} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatSliderModule} from '@angular/material/slider';
import {provideRouter} from '@angular/router';
import {Task} from 'src/app/api/models/task';
import {AlertService} from '../../services/alert.service';
import {ConfirmationModalService} from '../confirmation-modal/confirmation-modal.service';
import {TaskDateSliderComponent} from './task-date-slider.component';

describe('TaskDateSliderComponent labels', () => {
  let fixture: ComponentFixture<TaskDateSliderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskDateSliderComponent],
      imports: [FormsModule, MatSliderModule],
      providers: [
        provideRouter([]),
        {provide: AlertService, useValue: {}},
        {provide: ConfirmationModalService, useValue: {}},
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TaskDateSliderComponent);
    fixture.componentRef.setInput('task', {
      id: 41,
      definition: {name: 'First task', abbreviation: '1.1P'},
      unit: {totalWeeks: 12, allowFlexibleDates: false},
      project: {specConDays: 0},
      dueWeek: 2,
      localDueDateString: () => '20 Sep',
      localDueDate: () => new Date('2026-09-20'),
      localDeadlineDate: () => new Date('2026-09-30'),
    } as unknown as Task);
    fixture.detectChanges();
  });

  it('associates Complete By with the native slider thumb', () => {
    const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(label.textContent).toContain('Complete By');
    expect(label.control).toBe(input);
    expect(input.disabled).toBe(true);
    expect(input.id).toBe('task-due-date-41');
  });

  it('keeps the thumb named when the task abbreviation replaces the label', async () => {
    fixture.componentRef.setInput('showTaskAbbr', true);
    fixture.detectChanges();
    fixture.componentInstance.editMode = true;
    fixture.detectChanges();
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('aria-label')).toBe('Complete by for 1.1P');
    expect(input.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('label')).toBeNull();
  });

  it('renders deadline warnings as text rather than control labels', () => {
    fixture.componentInstance.editMode = true;
    fixture.componentInstance.task.localDeadlineDate = () => new Date('2026-09-19');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('p')?.textContent).toContain('Warning:');
    expect(fixture.nativeElement.querySelectorAll('label')).toHaveLength(1);
  });
});
