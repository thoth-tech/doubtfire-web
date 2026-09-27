import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CommonModule} from '@angular/common';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatBadgeModule} from '@angular/material/badge';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatMenuModule} from '@angular/material/menu';
import {MatTooltipModule} from '@angular/material/tooltip';
import {RouterLink, provideRouter} from '@angular/router';
import {BehaviorSubject} from 'rxjs';
import {Project, Task, TaskDefinition} from 'src/app/api/models/doubtfire-model';
import {UserService} from 'src/app/api/services/user.service';
import {StatusIconComponent} from 'src/app/common/status-icon/status-icon.component';
import {expectAccessible} from 'src/app/common/testing/accessibility';
import {FUnitTaskListComponent} from './unit-task-list.component';

// Use Material's real list implementation: a schema-only render cannot reveal
// that custom mat-list-item hosts have neither native focus nor key activation.
describe('FUnitTaskListComponent native task actions', () => {
  let fixture: ComponentFixture<FUnitTaskListComponent>;
  let taskDefinition: TaskDefinition;

  beforeEach(async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    await TestBed.configureTestingModule({
      declarations: [FUnitTaskListComponent, StatusIconComponent],
      imports: [
        CommonModule,
        FormsModule,
        MatBadgeModule,
        MatButtonModule,
        MatIconModule,
        MatListModule,
        MatMenuModule,
        MatTooltipModule,
        RouterLink,
      ],
      providers: [provideRouter([]), {provide: UserService, useValue: {currentUser: {id: 1}}}],
      // Only the expanded portfolio child is outside this test's scope.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    taskDefinition = {
      id: 1,
      seq: 1,
      abbreviation: '1.1P',
      name: 'Prepare your first submission',
      targetGrade: 0,
      isGroupTask: () => false,
    } as unknown as TaskDefinition;
    fixture = TestBed.createComponent(FUnitTaskListComponent);
    const component = fixture.componentInstance;
    component.mode = 'all-tasks';
    component.taskDefinitions = [taskDefinition];
    component.tasks = [];
    component.selectedTaskDefinition$ = new BehaviorSubject<TaskDefinition>(null);
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([false, true])(
    'provides a focusable native button with toggle state when collapsed=%s',
    async (collapsed) => {
      fixture.componentInstance.isCollapsed = collapsed;
      fixture.detectChanges();
      await fixture.whenStable();
      await expectAccessible(fixture.nativeElement);
      const row: HTMLButtonElement = fixture.nativeElement.querySelector('.mat-mdc-list-item');
      // jsdom does not synthesize browser click defaults for keyboard events.
      // Native button semantics supply Enter/Space activation without custom handlers.
      expect(row instanceof HTMLButtonElement).toBe(true);
      expect(row.type).toBe('button');
      expect(row.tabIndex).toBe(0);
      row.focus();
      expect(document.activeElement).toBe(row);
      expect(row.getAttribute('aria-pressed')).toBe('false');
      row.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.selectedTaskDefinition$.value).toBe(taskDefinition);
      expect(row.getAttribute('aria-pressed')).toBe('true');
      row.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.selectedTaskDefinition$.value).toBeNull();
      expect(row.getAttribute('aria-pressed')).toBe('false');
      expect(row.querySelector('button, a, input, select, textarea, [tabindex]')).toBeNull();
    },
  );

  it('keeps the full task name and status badges in the collapsed button contents', async () => {
    fixture.componentInstance.isCollapsed = true;
    fixture.componentInstance.tasks = [
      {
        definition: taskDefinition,
        status: 'not_started',
        numNewComments: 2,
        similaritiesDetected: true,
        hasGrade: () => false,
        hasQualityPoints: () => false,
        isDueSoon: () => true,
        inFinalState: () => false,
        betweenDueDateAndDeadlineDate: () => false,
        isPastDeadline: () => false,
      } as unknown as Task,
    ];
    fixture.detectChanges();
    await fixture.whenStable();
    const row: HTMLButtonElement = fixture.nativeElement.querySelector('button[mat-list-item]');
    expect(row.textContent).toContain(taskDefinition.abbreviation);
    expect(row.querySelector('.sr-only')?.textContent).toContain(taskDefinition.name);
    // A row-level name would override the status and badge names from its children.
    expect(row.hasAttribute('aria-label')).toBe(false);
    expect(row.hasAttribute('aria-labelledby')).toBe(false);
    const badgeNames = Array.from(
      row.querySelectorAll('[role="img"]:not([aria-hidden="true"])'),
    ).map((badge) => badge.getAttribute('aria-label'));
    expect(badgeNames).toEqual([
      'Due soon',
      'Not Started',
      '2 new comments',
      'Similarities Detected',
    ]);
  });

  it('names the collapsed portfolio link while retaining its status', async () => {
    fixture.componentInstance.mode = 'project';
    fixture.componentInstance.isCollapsed = true;
    fixture.componentInstance.project = {
      id: 42,
      unit: {id: 7},
      targetGrade: 0,
      portfolioTaskStatusClass: () => 'not-started',
      portfolioTaskStatus: () => 'not_started',
    } as unknown as Project;
    fixture.detectChanges();
    await fixture.whenStable();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(link.getAttribute('href')).toBe('/projects/42/portfolio');
    expect(link.querySelector('.sr-only')?.textContent).toBe('Create portfolio');
    expect(
      link.querySelector('[role="img"]:not([aria-hidden="true"])')?.getAttribute('aria-label'),
    ).toBe('Not Started');
    expect(link.hasAttribute('aria-label')).toBe(false);
    expect(link.tabIndex).toBe(0);
  });
});
