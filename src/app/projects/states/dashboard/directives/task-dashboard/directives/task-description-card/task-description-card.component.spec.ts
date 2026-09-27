import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Project} from 'src/app/api/models/project';
import {Task} from 'src/app/api/models/task';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {Unit} from 'src/app/api/models/unit';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {MarkedPipe} from 'src/app/common/pipes/marked.pipe';
import {GradeService} from 'src/app/common/services/grade.service';
import {TaskDescriptionCardComponent} from './task-description-card.component';

function buildTask(overrides: {
  unitCode?: string;
  abbreviation?: string;
  name?: string;
  taskDefId?: number;
  dueDate?: Date;
  hasTaskSheet?: boolean;
  hasTaskResources?: boolean;
  taskSheetFilename?: string;
}): Task {
  const unit = new Unit();
  unit.code = overrides.unitCode ?? 'COS10001';
  unit.allowFlexibleDates = false;

  const definition = new TaskDefinition(unit);
  definition.id = overrides.taskDefId ?? 42;
  definition.abbreviation = overrides.abbreviation ?? '1.1P';
  definition.name = overrides.name ?? 'Hello World';
  definition.description = '';
  definition.targetDate = undefined;
  definition.startDate = new Date(2026, 8, 1);
  definition.targetGrade = 0;
  definition.hasTaskSheet = overrides.hasTaskSheet ?? true;
  definition.taskSheetFilename = overrides.taskSheetFilename;
  definition.hasTaskResources = overrides.hasTaskResources ?? false;

  const task = new Task(unit);
  task.definition = definition;
  task.dueDate = overrides.dueDate;
  task.project = new Project(unit);
  task.project.targetGrade = 0;
  vi.spyOn(task, 'localDeadlineDate').mockReturnValue(overrides.dueDate);

  return task;
}

describe('TaskDescriptionCardComponent', () => {
  let component: TaskDescriptionCardComponent;
  let fixture: ComponentFixture<TaskDescriptionCardComponent>;
  const downloadFile = vi.fn();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskDescriptionCardComponent, MarkedPipe],
      imports: [NoopAnimationsModule, MatButtonModule, MatIconModule],
      providers: [GradeService, {provide: FileDownloaderService, useValue: {downloadFile}}],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskDescriptionCardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    // window.open is a real global. vi.spyOn replaces it in place and, without this,
    // the replacement and its call history persist across tests, since neither
    // restoreMocks nor clearMocks is configured globally for this project (checked
    // angular.json's test builder options and src/vitest-setup.ts, neither sets
    // either). vi.restoreAllMocks() restores the original window.open and clears the
    // spy's history after every test, not just the ones that create it directly.
    vi.restoreAllMocks();
    downloadFile.mockReset();
  });

  it('uses the API-authoritative task-sheet filename with a rolling-safe fallback', () => {
    const task = buildTask({
      unitCode: 'COS10001',
      abbreviation: '1.1P',
      taskSheetFilename: 'COS10001-1.1P-TaskSheet.pdf',
    });
    component.task = task;
    component.taskDef = task.definition;
    component.unit = task.unit;
    vi.spyOn(task.definition, 'getTaskPDFUrl').mockReturnValue('/task-sheet');

    component.downloadTaskSheet();

    expect(downloadFile).toHaveBeenCalledWith('/task-sheet', 'COS10001-1.1P-TaskSheet.pdf');

    task.definition.taskSheetFilename = undefined;
    component.downloadTaskSheet();
    expect(downloadFile).toHaveBeenLastCalledWith('/task-sheet', 'COS10001-1.1P-TaskSheet.pdf');
  });

  it('renders the Add to Google Calendar button when the task has a due date, with a correct href, target and rel', () => {
    // 23:59:59.999 local, the only time-of-day Task.dueDate actually carries. It maps
    // through MappingFunctions.mapDateToEndOfDay in the real app (task.service.ts), a
    // bare local-midnight fixture is not a value the app ever produces.
    const dueDate = new Date(2026, 8, 15, 23, 59, 59, 999);
    const task = buildTask({dueDate});
    component.task = task;
    component.taskDef = task.definition;
    component.unit = task.unit;
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      'a.add-to-google-calendar-link',
    );

    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe(component.googleCalendarUrl);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('is absent from the DOM when the task has no resolvable due date', () => {
    const task = buildTask({dueDate: undefined});
    component.task = task;
    component.taskDef = task.definition;
    component.unit = task.unit;
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a.add-to-google-calendar-link');

    expect(link).toBeNull();
  });

  it('renders the button when the task has a due date but neither a task sheet nor resources', () => {
    // The button's own container used to be mat-card-actions, hidden unless
    // hasTaskSheet or hasTaskResources is true. The calendar button now has its own
    // container gated only by whether a due date resolves, this proves it is no longer
    // tied to that unrelated condition.
    const dueDate = new Date(2026, 8, 15, 23, 59, 59, 999);
    const task = buildTask({dueDate, hasTaskSheet: false, hasTaskResources: false});
    component.task = task;
    component.taskDef = task.definition;
    component.unit = task.unit;
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a.add-to-google-calendar-link');

    expect(link).not.toBeNull();
  });

  it('builds the exact Google Calendar URL, with an exclusive end date one day after the due date', () => {
    const dueDate = new Date(2026, 8, 15, 23, 59, 59, 999);
    const task = buildTask({
      unitCode: 'COS10001',
      abbreviation: '1.1P',
      name: 'Hello World',
      taskDefId: 42,
      dueDate,
    });
    component.task = task;

    const url = component.googleCalendarUrl;

    expect(url).toBe(
      'https://calendar.google.com/calendar/render?' +
        'action=TEMPLATE&' +
        'text=COS10001%3A%201.1P%3A%20Hello%20World&' +
        'dates=20260915%2F20260916',
    );
  });

  it('keeps the rendered and activated calendar URL current when the same task is mutated', () => {
    const task = buildTask({dueDate: new Date(2026, 8, 15, 23, 59, 59, 999)});
    task.project = new Project(task.unit);
    task.project.targetGrade = 0;
    task.definition.dueDate = new Date(2026, 11, 1, 23, 59, 59, 999);
    component.task = task;
    component.taskDef = task.definition;
    component.unit = task.unit;
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      'a.add-to-google-calendar-link',
    );
    expect(link.getAttribute('href')).toContain('dates=20260915%2F20260916');

    task.dueDate = new Date(2026, 8, 22, 23, 59, 59, 999);
    fixture.detectChanges();

    expect(link.getAttribute('href')).toContain('dates=20260922%2F20260923');

    task.unit.allowFlexibleDates = true;
    task.targetDueDate = new Date(2026, 8, 29, 23, 59, 59, 999);
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    link.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', cancelable: true}));

    expect(windowOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining('dates=20260929%2F20260930'),
      '_blank',
      'noopener,noreferrer',
    );

    fixture.detectChanges();
    expect(link.getAttribute('href')).toContain('dates=20260929%2F20260930');
  });

  it('produces the correct dates range for a due date the day before Melbourne DST starts, which the old MappingFunctions.addDays approach got wrong', () => {
    // Confirmed against the ICU timezone database: 2026-10-03 is AEST (UTC+10),
    // 2026-10-04 is AEDT (UTC+11). Melbourne's clocks spring forward overnight
    // between these two dates.
    //
    // The old approach (before this fix) held event.date as a Date instant and
    // called MappingFunctions.addDays, which adds a fixed 24 hours of real
    // elapsed time, then read the result back via local calendar getters. For a
    // task due 2026-10-03, Task.localDueDate() resolved to 23:59:59.999 local
    // time, 13:59:59.999 UTC while still on AEST. Reconstructed here exactly, to
    // prove what that approach actually produced, since the buggy code itself no
    // longer exists in this file to call directly.
    const dueDateInstantUtc = Date.UTC(2026, 9, 3, 13, 59, 59, 999);
    const oldBuggyEndInstant = dueDateInstantUtc + 24 * 60 * 60 * 1000;
    const melbourneCivilDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Melbourne',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    // Adding a fixed 24 hours crosses the DST transition, so the wall-clock
    // result lands an hour later than a plain "next day" would, which is enough
    // to push it past midnight into a second day. The old approach's end date is
    // 2026-10-05, not 2026-10-04, confirmed both by this direct reconstruction
    // and empirically against the real ICU timezone database before writing this
    // test. This assertion is the proof this test would fail against the old
    // approach, not a description of it.
    expect(melbourneCivilDate.format(oldBuggyEndInstant)).toBe('2026-10-05');

    // The test container itself runs in UTC (confirmed separately), which has no
    // DST, so exercising the real component pipeline in this environment cannot
    // by itself distinguish old from new behaviour, UTC never crosses a DST
    // transition regardless of which calendar date is chosen. The assertion
    // above is what makes this test meaningful, the assertion below confirms
    // the current, fixed production code produces the correct civil-date
    // arithmetic (2026-10-03 to 2026-10-04) that the old approach failed to.
    // Reuses dueDateInstantUtc, the same 23:59:59.999-Melbourne-local instant
    // established above, as the realistic Task.dueDate fixture value.
    const task = buildTask({dueDate: new Date(dueDateInstantUtc)});
    component.task = task;

    const url = component.googleCalendarUrl;

    expect(url).toContain('dates=20261003%2F20261004');
  });

  it('opens the calendar URL in a new tab, with noopener and noreferrer, when Space is pressed on the link', () => {
    // jsdom cannot assert on actual navigation, so this spies on window.open, the
    // browser API handleCalendarLinkKeydown calls directly, and dispatches a real
    // keydown so the (keydown) template binding itself is exercised, not just the
    // handler method in isolation. ' ' is the real browser event.key value for the
    // space bar, not code: 'Space'.
    const dueDate = new Date(2026, 8, 15, 23, 59, 59, 999);
    const task = buildTask({dueDate});
    component.task = task;
    component.taskDef = task.definition;
    component.unit = task.unit;
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      'a.add-to-google-calendar-link',
    );
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const keyboardEvent = new KeyboardEvent('keydown', {key: ' ', cancelable: true});
    const preventDefaultSpy = vi.spyOn(keyboardEvent, 'preventDefault');

    link.dispatchEvent(keyboardEvent);

    expect(preventDefaultSpy).toHaveBeenCalledOnce();
    expect(windowOpenSpy).toHaveBeenCalledWith(
      component.googleCalendarUrl,
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('does not call window.open for a keydown that is not Space', () => {
    // The handler now receives every keydown on the link, not just Space, since the
    // template binding is plain (keydown) rather than Angular's (keydown.space)
    // modifier. This proves the handler's own key check actually filters, it is not
    // relying on Angular to only call it for the space key.
    const dueDate = new Date(2026, 8, 15, 23, 59, 59, 999);
    const task = buildTask({dueDate});
    component.task = task;
    component.taskDef = task.definition;
    component.unit = task.unit;
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      'a.add-to-google-calendar-link',
    );
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    link.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', cancelable: true}));

    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  describe('key dates timeline', () => {
    function timelineTask(status: Task['status'] = 'not_started'): Task {
      const task = buildTask({dueDate: new Date(2026, 8, 15, 23, 59, 59, 999)});
      task.project = new Project(task.unit);
      task.project.targetGrade = 0;
      task.project.specConDays = 0;
      task.definition.dueDate = new Date(2026, 8, 29, 23, 59, 59, 999);
      // Exercise the real feedback deadline, including special consideration,
      // instead of the calendar-link fixture's due-date stub.
      vi.mocked(task.localDeadlineDate).mockRestore();
      task.status = status;
      return task;
    }

    function render(task: Task): HTMLElement[] {
      component.task = task;
      component.taskDef = task.definition;
      component.unit = task.unit;
      fixture.detectChanges();
      return Array.from(fixture.nativeElement.querySelectorAll('.task-dates__step'));
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('lists the start, due and feedback dates in order', () => {
      vi.useFakeTimers({toFake: ['Date']});
      vi.setSystemTime(new Date(2026, 8, 10, 9, 0));

      const steps = render(timelineTask());

      expect(
        steps.map((step) => step.querySelector('.task-dates__label').textContent.trim()),
      ).toEqual(['Start', 'Due', 'Feedback by']);
      expect(
        steps.map((step) => step.querySelector('.task-dates__date').textContent.trim()),
      ).toEqual(['Tue 1 Sep', 'Tue 15 Sep', 'Tue 29 Sep']);
    });

    it('includes special consideration in the feedback date without moving the due date', () => {
      vi.useFakeTimers({toFake: ['Date']});
      vi.setSystemTime(new Date(2026, 8, 10, 9, 0));
      const task = timelineTask();
      task.project.specConDays = 2;

      const steps = render(task);

      expect(
        steps.map((step) => step.querySelector('.task-dates__date').textContent.trim()),
      ).toEqual(['Tue 1 Sep', 'Tue 15 Sep', 'Thu 1 Oct']);
    });

    it('marks the dates that have passed and says when the next one is', () => {
      vi.useFakeTimers({toFake: ['Date']});
      vi.setSystemTime(new Date(2026, 8, 10, 9, 0));

      const [start, due, feedback] = render(timelineTask());

      expect(start.classList).toContain('task-dates__step--passed');
      expect(due.classList).toContain('task-dates__step--next');
      expect(due.querySelector('.task-dates__when').textContent.trim()).toBe('In 5 days');
      expect(feedback.classList).not.toContain('task-dates__step--next');
      expect(feedback.querySelector('.task-dates__when')).toBeNull();
    });

    it('says Today for a date later the same day', () => {
      vi.useFakeTimers({toFake: ['Date']});
      vi.setSystemTime(new Date(2026, 8, 15, 9, 0));

      const [, due] = render(timelineTask());

      expect(due.querySelector('.task-dates__when').textContent.trim()).toBe('Today');
    });

    it('fills the line between two dates by how much of the time has gone', () => {
      vi.useFakeTimers({toFake: ['Date']});
      // Halfway between the start (1 Sept, midnight) and the due date (15 Sept, 23:59).
      const start = new Date(2026, 8, 1).getTime();
      const due = new Date(2026, 8, 15, 23, 59, 59, 999).getTime();
      vi.setSystemTime(new Date(start + (due - start) / 2));

      render(timelineTask());
      const [first, second] = component.keyDates;

      expect(first.progress).toBeCloseTo(0.5, 2);
      expect(second.progress).toBe(0);
    });

    it('keeps the dates but drops the countdown once the task is submitted', () => {
      vi.useFakeTimers({toFake: ['Date']});
      vi.setSystemTime(new Date(2026, 8, 10, 9, 0));

      const steps = render(timelineTask('ready_for_feedback'));

      expect(steps).toHaveLength(3);
      expect(fixture.nativeElement.querySelector('.task-dates__step--next')).toBeNull();
      expect(fixture.nativeElement.querySelector('.task-dates__when')).toBeNull();
    });

    it('puts a planned submit date after the feedback date in date order, and flags it', () => {
      vi.useFakeTimers({toFake: ['Date']});
      vi.setSystemTime(new Date(2026, 8, 10, 9, 0));
      const task = timelineTask();
      task.unit.allowFlexibleDates = true;
      task.targetDueDate = new Date(2026, 8, 30, 23, 59, 59, 999);
      task.definition.dueDate = new Date(2026, 8, 15, 23, 59, 59, 999);

      const steps = render(task);

      expect(
        steps.map((step) => step.querySelector('.task-dates__label').textContent.trim()),
      ).toEqual(['Planned start', 'Feedback by', 'Planned submit']);
      // The nearer feedback date is the one to count down to.
      expect(steps[1].classList).toContain('task-dates__step--next');
      expect(steps[1].querySelector('.task-dates__when').textContent.trim()).toBe('In 5 days');
      expect(steps[2].querySelector('.task-dates__warning').textContent).toContain(
        'After the feedback date',
      );
    });

    it('draws each change detection pass for one moment, so the development check agrees', () => {
      let clock = new Date(2026, 8, 10, 9, 0).getTime();
      // Every read of the clock moves it on a minute and a bit, which would change the
      // countdown and the line between Angular's check and its development re-check.
      vi.spyOn(Date, 'now').mockImplementation(() => (clock += 61_000));

      expect(() => render(timelineTask())).not.toThrow();
    });

    it('notes an extension on the due date', () => {
      vi.useFakeTimers({toFake: ['Date']});
      vi.setSystemTime(new Date(2026, 8, 10, 9, 0));
      const task = timelineTask();
      task.extensions = 2;

      const [, due] = render(task);

      expect(due.querySelector('.task-dates__note').textContent.trim()).toBe('Extended 2 weeks');
    });
  });

  it('does not call window.open on Space when there is no resolvable due date', () => {
    // Defensive coverage for handleCalendarLinkKeydown's own null guard. The anchor
    // only renders inside @if (googleCalendarUrl), so this branch is unreachable through
    // the DOM, called directly here rather than left untested.
    const task = buildTask({dueDate: undefined});
    component.task = task;

    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const keyboardEvent = new KeyboardEvent('keydown', {key: ' ', cancelable: true});

    component.handleCalendarLinkKeydown(keyboardEvent);

    expect(windowOpenSpy).not.toHaveBeenCalled();
  });
});

function bareCard(): TaskDescriptionCardComponent {
  return Object.create(TaskDescriptionCardComponent.prototype) as TaskDescriptionCardComponent;
}

describe('TaskDescriptionCardComponent feedback deadline', () => {
  const deadline = new Date('2026-09-01T00:00:00Z');

  it('reads the task deadline when a task is present', () => {
    const component = bareCard();
    component.task = {localDeadlineDate: () => deadline} as unknown as Task;

    expect(component.feedbackDate()).toBe(deadline);
  });

  it('falls back to the task-definition deadline when there is no task', () => {
    const component = bareCard();
    component.task = undefined;
    component.taskDef = {localDeadlineDate: () => deadline} as unknown as TaskDefinition;

    expect(component.feedbackDate()).toBe(deadline);
  });

  it('returns no deadline when neither model has one', () => {
    const component = bareCard();
    component.task = undefined;
    component.taskDef = undefined;

    expect(component.feedbackDate()).toBeUndefined();
  });

  it('emphasises only task deadlines within fourteen days', () => {
    const near = bareCard();
    near.task = {daysUntilDeadlineDate: () => 10} as unknown as Task;
    expect(near.shouldShowDeadline()).toBe(true);

    const far = bareCard();
    far.task = {daysUntilDeadlineDate: () => 21} as unknown as Task;
    expect(far.shouldShowDeadline()).toBe(false);
  });

  it('does not emphasise a deadline when there is no task', () => {
    const component = bareCard();
    component.task = undefined;

    expect(component.shouldShowDeadline()).toBeFalsy();
  });
});
