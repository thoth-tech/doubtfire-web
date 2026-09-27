import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatMenuModule} from '@angular/material/menu';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatTabsModule} from '@angular/material/tabs';
import {ActivatedRoute} from '@angular/router';
import {BehaviorSubject, Subject} from 'rxjs';
import {Task} from 'src/app/api/models/task';
import {TaskService} from 'src/app/api/services/task.service';
import {UserService} from 'src/app/api/services/user.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {DashboardViews, SelectedTaskService} from '../../selected-task.service';
import {TaskDashboardComponent} from './task-dashboard.component';

describe('Task dashboard rendered tabs', () => {
  let fixture: ComponentFixture<TaskDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskDashboardComponent],
      imports: [
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatProgressSpinnerModule,
        MatTabsModule,
      ],
      providers: [
        {
          provide: TaskService,
          useValue: {
            markedStatuses: [],
            statusSeq: new Map(),
            taskSubmissionCompleted$: new Subject(),
          },
        },
        {provide: UserService, useValue: {}},
        {provide: ActivatedRoute, useValue: {}},
        {provide: FileDownloaderService, useValue: {}},
        {
          provide: SelectedTaskService,
          useValue: {currentView$: new BehaviorSubject(DashboardViews.details)},
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(TaskDashboardComponent);
    fixture.componentInstance.task = {
      definition: {hasTaskSheet: true},
      hasPdf: false,
      processingPdf: false,
      project: {},
      unit: {staff: []},
      submissionUrl: () => '/synthetic-submission.pdf',
      hasSubmissionHistory() {
        return this.hasPdf || this.processingPdf;
      },
    } as unknown as Task;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('retains Material disabled semantics for an unavailable submission', () => {
    const root: HTMLElement = fixture.nativeElement;
    const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));
    expect(tabs.map((tab) => tab.textContent.trim())).toEqual([
      'Task Details',
      'Task Sheet',
      'Your Submission',
    ]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-disabled')).toBe('false');
    expect(tabs[2].getAttribute('aria-disabled')).toBe('true');
    expect(tabs[2].classList.contains('mat-mdc-tab-disabled')).toBe(true);
    expect(tabs[2].tabIndex).toBe(-1);
    tabs[2].click();
    expect(fixture.componentInstance.currentView).toBe(DashboardViews.details);
  });

  it('keeps an available submission as an enabled, selectable inactive tab', async () => {
    Object.assign(fixture.componentInstance.task, {hasPdf: true});
    fixture.detectChanges();
    await fixture.whenStable();
    const submission: HTMLElement = fixture.nativeElement.querySelectorAll('[role="tab"]')[2];
    expect(submission.getAttribute('aria-disabled')).toBe('false');
    expect(submission.classList.contains('mat-mdc-tab-disabled')).toBe(false);
    expect(submission.getAttribute('aria-selected')).toBe('false');
    submission.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.currentView).toBe(DashboardViews.submission);
    expect(submission.getAttribute('aria-selected')).toBe('true');
  });
});
