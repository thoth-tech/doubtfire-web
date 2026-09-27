import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CommonModule} from '@angular/common';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatMenuModule} from '@angular/material/menu';
import {Subject, of} from 'rxjs';
import {DiscussionPrompt} from 'src/app/api/models/discussion-prompt';
import {
  ActivityTypeService,
  Engagement,
  EngagementCommentService,
  EngagementService,
  Unit,
  UserService,
} from 'src/app/api/models/doubtfire-model';
import {DiscussionPromptService} from 'src/app/api/services/discussion-prompt.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {HumanizedDatePipe} from 'src/app/common/pipes/humanized-date.pipe';
import {LocalizedDatePipe} from 'src/app/common/pipes/localized-date.pipe';
import {MarkedPipe} from 'src/app/common/pipes/marked.pipe';
import {AlertService} from 'src/app/common/services/alert.service';
import {SkeletonLoaderComponent} from 'src/app/common/skeleton-loader/skeleton-loader.component';
import {EngagementDetailDialogComponent} from 'src/app/projects/states/dashboard/directives/progress-dashboard/engagement-passport-card/engagement-detail-dialog/engagement-detail-dialog.component';
import {DiscussionPromptsComponent} from 'src/app/projects/states/discussion-prompts/discussion-prompts.component';
import {CommunicationSchedulesComponent} from 'src/app/units/states/edit/directives/unit-communications-editor/communication-schedule-modal/communication-schedules.component';
import {UnitTutorialsManagerComponent} from 'src/app/units/states/edit/directives/unit-tutorials-manager/unit-tutorials-manager.component';
import {EmptyStateComponent} from './empty-state.component';

describe('Tutorial stream empty state', () => {
  it('keeps tutorial creation available and replaces the message after a stream is added', async () => {
    await TestBed.configureTestingModule({
      declarations: [UnitTutorialsManagerComponent],
      imports: [EmptyStateComponent, MatMenuModule],
      providers: [
        {provide: ActivityTypeService, useValue: {query: () => of([])}},
        {provide: AlertService, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    const fixture = TestBed.createComponent(UnitTutorialsManagerComponent);
    fixture.componentRef.setInput('unit', {tutorialStreams: [], tutorials: []} as unknown as Unit);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('f-empty-state').textContent).toContain(
      'No tutorial streams yet',
    );
    expect(fixture.nativeElement.querySelector('button').textContent).toContain('Add a stream');
    fixture.componentRef.setInput('unit', {
      tutorialStreams: [{id: 1}],
      tutorials: [],
    } as unknown as Unit);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('f-empty-state')).toBeNull();
    expect(fixture.nativeElement.querySelector('df-unit-tutorials-list')).not.toBeNull();
  });
});

describe('Discussion prompt states', () => {
  let result: Subject<DiscussionPrompt[]>;
  beforeEach(async () => {
    result = new Subject<DiscussionPrompt[]>();
    await TestBed.configureTestingModule({
      declarations: [DiscussionPromptsComponent],
      imports: [EmptyStateComponent, SkeletonLoaderComponent],
      providers: [
        {
          provide: DiscussionPromptService,
          useValue: {loadDiscussionPromptsForPoject: () => result},
        },
        {provide: UserService, useValue: {}},
        {provide: AlertService, useValue: {}},
        {provide: ConfirmationModalService, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('waits for an empty response before showing an empty state', () => {
    const fixture = TestBed.createComponent(DiscussionPromptsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('f-skeleton-loader')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'Loading discussion prompts',
    );
    expect(fixture.nativeElement.querySelector('f-empty-state')).toBeNull();
    result.next([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('f-skeleton-loader')).toBeNull();
    expect(fixture.nativeElement.querySelector('f-empty-state').textContent).toContain(
      'No discussion prompts',
    );
  });

  it('shows a retrieval error instead of an empty collection', () => {
    const fixture = TestBed.createComponent(DiscussionPromptsComponent);
    fixture.detectChanges();
    result.error(new Error('Unavailable'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('f-empty-state')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Unable to load',
    );
  });

  it('retains prompt content after a populated response', () => {
    const fixture = TestBed.createComponent(DiscussionPromptsComponent);
    fixture.detectChanges();
    result.next([
      {
        taskDefinition: {name: 'Task', abbreviation: '1.1P'},
        content: 'Explain your approach',
        priorityLabel: 'Normal',
      },
    ] as unknown as DiscussionPrompt[]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('f-empty-state')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Explain your approach');
  });
});

describe('Engagement comment states', () => {
  let result: Subject<Engagement>;
  const engagement = {comments: [], hasAttachment: false} as unknown as Engagement;
  beforeEach(async () => {
    result = new Subject<Engagement>();
    await TestBed.configureTestingModule({
      declarations: [
        EngagementDetailDialogComponent,
        HumanizedDatePipe,
        LocalizedDatePipe,
        MarkedPipe,
      ],
      imports: [CommonModule, FormsModule, EmptyStateComponent],
      providers: [
        {provide: MAT_DIALOG_DATA, useValue: {engagement}},
        {provide: EngagementService, useValue: {loadEngagement: () => result}},
        {provide: EngagementCommentService, useValue: {}},
        {provide: FileDownloaderService, useValue: {}},
        {provide: AlertService, useValue: {}},
        {provide: ConfirmationModalService, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('shows no-comments copy only after successful retrieval and keeps the composer', () => {
    const fixture = TestBed.createComponent(EngagementDetailDialogComponent);
    vi.spyOn(fixture.componentInstance, 'scrollToBottom').mockImplementation(() => {});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('f-empty-state')).toBeNull();
    result.next(engagement);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('f-empty-state').textContent).toContain(
      'No comments yet',
    );
    expect(fixture.nativeElement.querySelector('textarea')).not.toBeNull();
  });

  it('preserves the failed-retrieval message without claiming there are no comments', () => {
    const fixture = TestBed.createComponent(EngagementDetailDialogComponent);
    fixture.detectChanges();
    result.error(new Error('Unavailable'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('f-empty-state')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Unable to load this engagement.');
  });
});

describe('Communication schedule empty state', () => {
  it('replaces the empty message with the existing schedule actions when populated', async () => {
    await TestBed.configureTestingModule({
      declarations: [CommunicationSchedulesComponent],
      imports: [CommonModule, EmptyStateComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    const editSchedule = vi.fn();
    const fixture = TestBed.createComponent(CommunicationSchedulesComponent);
    fixture.componentRef.setInput('editor', {
      setPreviewLoading: false,
      scheduleTrackId: () => 1,
      scheduleSummary: () => 'Weekly',
      scheduleAnchorSummary: () => '',
      scheduleTimeSummary: () => '',
      scheduleNextRunSummary: () => '',
      scheduleLastRunSummary: () => '',
      editSchedule,
    });
    fixture.componentRef.setInput('set', {schedules: []});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('f-empty-state').textContent).toContain(
      'No schedules yet',
    );
    const schedule = {name: 'Weekly reminder', active: true};
    const set = {schedules: [schedule]};
    fixture.componentRef.setInput('set', set);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('f-empty-state')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Weekly reminder');
    fixture.nativeElement.querySelector('button').click();
    expect(editSchedule).toHaveBeenCalledWith(set, schedule);
  });
});
