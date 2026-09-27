import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {TaskDueCardComponent} from './task-due-card.component';

describe('TaskDueCardComponent', () => {
  let component: TaskDueCardComponent;
  let fixture: ComponentFixture<TaskDueCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskDueCardComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TaskDueCardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the due-soon message in sentence case with a breathable responsive card', () => {
    component.task = {
      unit: {allowFlexibleDates: false},
      inFinalState: () => false,
      inTimeExceeded: () => false,
      isPastDeadline: () => false,
      inAwaitingFeedbackState: () => false,
      isDueSoon: () => true,
      isPastDueDate: () => false,
      timeUntilDueDateDescription: () => '3 days',
      inDiscussState: () => false,
      localDueDateString: () => '1 Sep',
      betweenDueDateAndDeadlineDate: () => false,
    } as never;
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.task-due-card--soon');
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('Aim to complete soon – due in 3 days');

    const styles = (TaskDueCardComponent as unknown as {ɵcmp: {styles: string[]}}).ɵcmp.styles.join(
      '\n',
    );
    expect(styles).toContain('padding: 1rem 1rem 0.5rem');
    expect(styles).toContain('overflow-wrap: anywhere');
  });
});
