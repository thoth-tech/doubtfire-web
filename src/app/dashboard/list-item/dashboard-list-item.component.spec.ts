import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {RouterLink, provideRouter} from '@angular/router';
import {TaskDefinition} from '../../api/models/task-definition';
import {TaskStatus} from '../../api/models/task-status';
import {StatusIconComponent} from '../../common/status-icon/status-icon.component';
import {
  DashboardListItemComponent,
  DashboardTask,
  getDueDateWarning,
} from './dashboard-list-item.component';

describe('getDueDateWarning', () => {
  const now = new Date('2026-08-23T00:00:00.000Z');
  const day = 24 * 60 * 60 * 1000;

  it.each([
    {offset: -1, state: 'overdue', label: 'Overdue', icon: 'error'},
    {
      offset: day,
      state: 'within24Hours',
      label: 'Due within 24 hours',
      icon: 'schedule',
    },
    {
      offset: day + 1,
      state: 'within3Days',
      label: 'Due within 3 days',
      icon: 'warning',
    },
    {
      offset: 3 * day,
      state: 'within3Days',
      label: 'Due within 3 days',
      icon: 'warning',
    },
    {
      offset: 3 * day + 1,
      state: 'within7Days',
      label: 'Due within 7 days',
      icon: 'event',
    },
    {
      offset: 7 * day,
      state: 'within7Days',
      label: 'Due within 7 days',
      icon: 'event',
    },
  ])('returns $state at the expected boundary', ({offset, state, label, icon}) => {
    const dueDate = new Date(now.getTime() + offset);

    expect(getDueDateWarning(dueDate, true, now)).toEqual({state, label, icon});
  });

  it('treats a task due now as due within 24 hours', () => {
    expect(getDueDateWarning(now, true, now)?.state).toBe('within24Hours');
  });

  it('does not warn more than seven days before the due date', () => {
    const dueDate = new Date(now.getTime() + 7 * day + 1);

    expect(getDueDateWarning(dueDate, true, now)).toBeNull();
  });

  it('does not warn for a submitted task', () => {
    const overdueDate = new Date(now.getTime() - day);

    expect(getDueDateWarning(overdueDate, false, now)).toBeNull();
  });

  it.each([null, undefined, new Date('invalid')])(
    'ignores a missing or invalid date',
    (dueDate) => {
      expect(getDueDateWarning(dueDate, true, now)).toBeNull();
    },
  );
});

describe('DashboardListItemComponent', () => {
  let component: DashboardListItemComponent;
  let fixture: ComponentFixture<DashboardListItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DashboardListItemComponent, StatusIconComponent],
      imports: [MatButtonModule, MatIconModule, MatTooltipModule, RouterLink],
      providers: [provideRouter([])],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardListItemComponent);
    component = fixture.componentInstance;
    component.task = {
      taskDefinitionId: 10,
      title: 'Security Review',
      subtitle: '1.1P - Pass Task',
      statusLabel: 'Resubmit',
      abbreviation: '1.1P',
      comments: 0,
      hasFeedback: false,
      status: 'fix_and_resubmit',
      targetGrade: 0,
      targetGradeLabel: 'Pass',
      weight: 0,
      projectId: 1,
      description: 'Review the security findings.',
      taskDef: {} as TaskDefinition,
      unitCode: 'SIT764',
      dueDate: new Date(2026, 7, 12),
      showDueWarning: false,
    } satisfies DashboardTask;
    fixture.detectChanges();
  });

  it('shows a textual status without requiring the colour indicator', () => {
    expect(fixture.nativeElement.textContent).toContain('Status: Resubmit');
  });

  it('uses a labelled native button with expanded state for task details', () => {
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.getAttribute('aria-label')).toBe('Expand Security Review details');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-label')).toBe('Collapse Security Review details');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('uses a keyboard-focusable link for the task title', () => {
    const titleLink = fixture.nativeElement.querySelector('h4 a') as HTMLAnchorElement;

    expect(titleLink).not.toBeNull();
    expect(titleLink.textContent.trim()).toBe('Security Review');
    expect(titleLink.classList).toContain('focus-visible:outline-2');
    expect(titleLink.getAttribute('href')).toBe('/projects/1/dashboard/1.1P');
  });

  it('shows the staff feedback indicator only when feedback is present', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Staff feedback');

    fixture.componentRef.setInput('task', {
      ...component.task,
      hasFeedback: true,
    });
    fixture.detectChanges();

    const feedbackBadge = fixture.nativeElement.querySelector('.bg-green-100') as HTMLElement;
    const feedbackIcon = feedbackBadge.querySelector('mat-icon') as HTMLElement;

    expect(feedbackBadge).not.toBeNull();
    expect(feedbackBadge.textContent).toContain('Staff feedback');
    expect(feedbackIcon.textContent.trim()).toBe('feedback');
    expect(feedbackIcon.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders warning text and an icon alongside the separate status circle', () => {
    fixture.componentRef.setInput('task', {
      taskDefinitionId: 10,
      title: 'Accessible task',
      subtitle: '1.1P - Pass Task',
      statusLabel: 'Not Started',
      abbreviation: '1.1P',
      comments: 0,
      hasFeedback: false,
      status: 'not_started',
      targetGrade: 0,
      targetGradeLabel: 'Pass',
      weight: 0,
      projectId: 1,
      description: 'Description',
      taskDef: {} as DashboardTask['taskDef'],
      unitCode: 'COS10001',
      dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
      showDueWarning: true,
    } satisfies DashboardTask);

    fixture.detectChanges();

    expect(component.dueDateWarning?.state).toBe('within24Hours');

    const badge = fixture.nativeElement.querySelector('.bg-orange-100') as HTMLElement;
    const icon = badge.querySelector('mat-icon') as HTMLElement;
    const statusChip = fixture.nativeElement.querySelector(
      'status-icon .status-chip',
    ) as HTMLElement;

    expect(badge.textContent).toContain('Due within 24 hours');
    expect(icon.textContent.trim()).toBe('schedule');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.classList).toContain('!leading-none');
    expect(statusChip.classList).toContain('not-started');
    expect(statusChip.querySelector('mat-icon')?.textContent?.trim()).toBe(
      TaskStatus.STATUS_MATERIAL_ICONS.get('not_started'),
    );
    expect(fixture.nativeElement.textContent).toContain('Status: Not Started');
  });

  it('opens the feedback destination even when there are no unread comments', () => {
    fixture.componentRef.setInput('task', {...component.task, hasFeedback: true, comments: 0});
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector(
      'a[aria-label="Open staff feedback for Security Review"]',
    );
    expect(link.getAttribute('href')).toBe('/projects/1/dashboard/1.1P/feedback');
  });

  it('shows missing feedback metadata without claiming there is no feedback', () => {
    fixture.componentRef.setInput('task', {...component.task, hasFeedback: null});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Feedback unavailable');
    expect(fixture.nativeElement.querySelector('a[aria-label^="Open staff feedback"]')).toBeNull();
  });

  it('names the unread count and uses the accessible shared badge colour', () => {
    fixture.componentRef.setInput('task', {...component.task, comments: 3, hasFeedback: true});
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('[role="status"]');
    expect(badge.getAttribute('aria-label')).toBe('3 unread comments on Security Review');
    // The redesign's badge takes the themed primary pair, which keeps 4.5:1 in both themes.
    expect(badge.classList.contains('bg-ot-primary')).toBe(true);
    expect(badge.classList.contains('text-ot-on-primary')).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('New feedback');
  });

  it('does not announce an unread badge for a zero count', () => {
    expect(fixture.nativeElement.querySelector('[aria-label*="unread comments"]')).toBeNull();
  });
});
