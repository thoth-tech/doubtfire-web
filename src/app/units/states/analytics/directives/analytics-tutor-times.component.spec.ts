import {DateAdapter as CalendarDateAdapter, CalendarModule} from 'angular-calendar';
import {adapterFactory} from 'angular-calendar/date-adapters/date-fns';
import {enAU} from 'date-fns/locale';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {provideDateFnsAdapter} from '@angular/material-date-fns-adapter';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DATE_LOCALE} from '@angular/material/core';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatDateRangeInputHarness} from '@angular/material/datepicker/testing';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatTooltipModule} from '@angular/material/tooltip';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Observable, Subject, of, throwError} from 'rxjs';
import {MarkingSession} from 'src/app/api/models/marking-session';
import {Unit} from 'src/app/api/models/unit';
import {UserService} from 'src/app/api/services/user.service';
import {EmptyStateComponent} from 'src/app/common/empty-state/empty-state.component';
import {AlertService} from 'src/app/common/services/alert.service';
import {AnalyticsTutorTimesComponent, SessionEvent} from './analytics-tutor-times.component';

// Monday 14 September 2026, mid morning.
const TODAY = new Date(2026, 8, 14, 9, 30);

const day = (month: number, date: number) => new Date(2026, month, date);

interface SessionSeed {
  userId?: number;
  start: Date;
  minutes: number;
  duringTutorial?: boolean;
}

let nextSessionId = 1;
const session = ({userId = 7, start, minutes, duringTutorial = false}: SessionSeed) =>
  ({
    id: nextSessionId++,
    user: userId === undefined ? undefined : {id: userId},
    startTime: start,
    endTime: new Date(start.getTime() + minutes * 60_000),
    durationMinutes: minutes,
    duringTutorial,
    commentsAdded: 2,
    assessments: 1,
    submissionsOpened: 3,
  }) as unknown as MarkingSession;

type MockUnit = Unit & {
  getUserMarkingSessions: ReturnType<typeof vi.fn>;
  downloadTutorTimesSummaryCsv: ReturnType<typeof vi.fn>;
  downloadMyTutorTimeSessionsCsv: ReturnType<typeof vi.fn>;
};

const makeUnit = (
  id: number,
  myRole: string,
  sessions: () => Observable<MarkingSession[]> = () => of([]),
): MockUnit =>
  ({
    id,
    code: `COS1000${id}`,
    staff: [
      {role: myRole, user: {id: 7, firstName: 'Ada', name: 'Ada Lovelace'}},
      {role: 'Tutor', user: {id: 8, firstName: 'Brian', name: 'Brian Dang'}},
    ],
    getUserMarkingSessions: vi.fn(sessions),
    downloadTutorTimesSummaryCsv: vi.fn(() => of({id: 'summary'})),
    downloadMyTutorTimeSessionsCsv: vi.fn(() => of({id: 'mine'})),
  }) as unknown as MockUnit;

describe('AnalyticsTutorTimesComponent', () => {
  let fixture: ComponentFixture<AnalyticsTutorTimesComponent>;
  let component: AnalyticsTutorTimesComponent;
  let alertError: ReturnType<typeof vi.fn>;

  const page = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const start = async (unit: MockUnit): Promise<void> => {
    fixture.componentRef.setInput('unit', unit);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const lastRequest = (unit: MockUnit): [Date, Date] => {
    const call = unit.getUserMarkingSessions.mock.calls.at(-1);
    return [call[0], call[1]];
  };

  beforeEach(async () => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(TODAY);
    nextSessionId = 1;
    alertError = vi.fn();

    await TestBed.configureTestingModule({
      declarations: [AnalyticsTutorTimesComponent],
      imports: [
        CalendarModule.forRoot({provide: CalendarDateAdapter, useFactory: adapterFactory}),
        EmptyStateComponent,
        FormsModule,
        MatButtonModule,
        MatDatepickerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSlideToggleModule,
        MatTooltipModule,
        NoopAnimationsModule,
        ReactiveFormsModule,
      ],
      providers: [
        {provide: AlertService, useValue: {error: alertError}},
        {provide: UserService, useValue: {currentUser: {id: 7, name: 'Ada Lovelace'}}},
        {provide: MAT_DATE_LOCALE, useValue: enAU},
        provideDateFnsAdapter({
          parse: {dateInput: 'dd/MM/yyyy'},
          display: {
            dateInput: 'dd/MM/yyyy',
            monthYearLabel: 'MMMM yyyy',
            dateA11yLabel: 'do MMMM yyyy',
            monthYearA11yLabel: 'MMMM yyyy',
          },
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsTutorTimesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  describe('dates', () => {
    // It used to ask for eight days (a week back from today, plus today) while the
    // calendar showed seven.
    it('opens on the seven days ending today and asks for exactly those days', async () => {
      const unit = makeUnit(1, 'Convenor');
      await start(unit);

      expect(unit.getUserMarkingSessions).toHaveBeenCalledTimes(1);
      expect(lastRequest(unit)).toEqual([day(8, 8), day(8, 14)]);
      expect(page().querySelector('[data-range-label]')?.textContent?.trim()).toBe(
        '8 – 14 Sep 2026',
      );
    });

    it('moves a whole period at a time with Previous, Next and Today', async () => {
      const unit = makeUnit(1, 'Convenor');
      await start(unit);

      page().querySelector<HTMLButtonElement>('[data-go-previous]').click();
      expect(lastRequest(unit)).toEqual([day(8, 1), day(8, 7)]);

      page().querySelector<HTMLButtonElement>('[data-go-previous]').click();
      page().querySelector<HTMLButtonElement>('[data-go-next]').click();
      expect(lastRequest(unit)).toEqual([day(8, 1), day(8, 7)]);

      page().querySelector<HTMLButtonElement>('[data-go-today]').click();
      expect(lastRequest(unit)).toEqual([day(8, 8), day(8, 14)]);
    });

    // Stepping back 7 x 24 hours from midnight on 6 October lands at 11 pm on 28 September
    // wherever daylight saving starts on 4 October, which took the calendar a day off.
    it('steps by calendar days, so a daylight saving change cannot shift the dates', async () => {
      vi.setSystemTime(new Date(2026, 9, 12, 9));
      const unit = makeUnit(1, 'Convenor');
      await start(unit);
      expect(lastRequest(unit)).toEqual([day(9, 6), day(9, 12)]);

      component.goPreviousWeek();
      expect(lastRequest(unit)).toEqual([day(8, 29), day(9, 5)]);
      expect(component.viewDate).toEqual(day(8, 29));
    });

    it('labels the buttons by the length of the period', async () => {
      await start(makeUnit(1, 'Convenor'));
      const previous = () => page().querySelector('[data-go-previous]');
      expect(previous().getAttribute('aria-label')).toBe('Previous week');

      component.dateRange.setValue({start: day(8, 1), end: day(8, 14)});
      component.applyDateFields();
      fixture.detectChanges();
      expect(previous().getAttribute('aria-label')).toBe('Previous 14 days');
    });

    it('applies a picked range once both ends are chosen', async () => {
      const unit = makeUnit(1, 'Convenor');
      await start(unit);

      component.dateRange.setValue({start: day(7, 30), end: null});
      component.applyDateFields();
      expect(unit.getUserMarkingSessions).toHaveBeenCalledTimes(1);

      component.dateRange.setValue({start: day(7, 30), end: day(8, 2)});
      component.applyDateFields();
      expect(component.daysInWeek).toBe(4);
      expect(lastRequest(unit)).toEqual([day(7, 30), day(8, 2)]);
      expect(component.rangeLabel).toBe('30 Aug – 2 Sep 2026');
    });

    // The picker sets the first day and then clears the last, announcing each in turn. The
    // new first day was read with the old last day, applied, and the picker closed after
    // one click.
    it('waits for both clicks in the picker before changing the dates', async () => {
      const unit = makeUnit(1, 'Convenor');
      await start(unit);
      const range =
        await TestbedHarnessEnvironment.loader(fixture).getHarness(MatDateRangeInputHarness);

      await range.openCalendar();
      const calendar = await range.getCalendar();
      await calendar.selectCell({text: '1'});

      expect(await range.isCalendarOpen()).toBe(true);
      expect(unit.getUserMarkingSessions).toHaveBeenCalledTimes(1);

      await calendar.selectCell({text: '5'});

      expect(await range.isCalendarOpen()).toBe(false);
      expect(lastRequest(unit)).toEqual([day(8, 1), day(8, 5)]);
      expect(component.rangeLabel).toBe('1 – 5 Sep 2026');
    });

    it('applies a typed first day with the last day already in the field', async () => {
      const unit = makeUnit(1, 'Convenor');
      await start(unit);
      const range =
        await TestbedHarnessEnvironment.loader(fixture).getHarness(MatDateRangeInputHarness);

      await (await range.getStartInput()).setValue('01/09/2026');

      expect(lastRequest(unit)).toEqual([day(8, 1), day(8, 14)]);
      expect(component.daysInWeek).toBe(14);
    });

    it('puts the period back in the field when the picker closes half way', async () => {
      await start(makeUnit(1, 'Convenor'));

      component.dateRange.setValue({start: day(7, 30), end: null});
      component.onRangePickerClosed();

      expect(component.dateRange.getRawValue()).toEqual({start: day(8, 8), end: day(8, 14)});
    });

    it('refuses a range longer than a year and keeps the current one', async () => {
      const unit = makeUnit(1, 'Convenor');
      await start(unit);

      component.dateRange.setValue({start: new Date(2025, 0, 1), end: day(8, 14)});
      component.applyDateFields();

      expect(alertError).toHaveBeenCalledWith('You cannot select more than a year', 3000);
      expect(unit.getUserMarkingSessions).toHaveBeenCalledTimes(1);
      expect(component.dateRange.getRawValue()).toEqual({start: day(8, 8), end: day(8, 14)});
    });
  });

  describe('loading', () => {
    it('ignores a late answer for dates the calendar has already left', async () => {
      const answers: Subject<MarkingSession[]>[] = [];
      const unit = makeUnit(1, 'Convenor', () => {
        const answer: Subject<MarkingSession[]> = new Subject();
        answers.push(answer);
        return answer;
      });
      await start(unit);

      component.goPreviousWeek();
      answers[1].next([session({start: new Date(2026, 8, 3, 10), minutes: 30})]);
      answers[0].next([
        session({start: new Date(2026, 8, 10, 10), minutes: 30}),
        session({start: new Date(2026, 8, 11, 10), minutes: 30}),
      ]);

      expect(component.events.map((e) => e.start)).toEqual([new Date(2026, 8, 3, 10)]);
    });

    // The spinner used to stay up forever after a failed request.
    it('stops loading and offers a retry when the sessions cannot be loaded', async () => {
      let fail = true;
      const unit = makeUnit(1, 'Convenor', () =>
        fail ? throwError(() => 'Server unavailable') : of([]),
      );
      await start(unit);

      expect(component.isLoading).toBe(false);
      const error = page().querySelector('[data-sessions-error]');
      expect(error?.textContent).toContain('Marking sessions could not be loaded');
      expect(error?.textContent).toContain('Server unavailable');
      expect(page().querySelector('mat-progress-bar')).toBeNull();

      fail = false;
      error.querySelector('button').click();
      fixture.detectChanges();

      expect(unit.getUserMarkingSessions).toHaveBeenCalledTimes(2);
      expect(page().querySelector('[data-sessions-error]')).toBeNull();
    });

    it('shows a progress bar while a request is out', async () => {
      await start(makeUnit(1, 'Convenor', () => new Subject<MarkingSession[]>()));

      expect(page().querySelector('mat-progress-bar')).not.toBeNull();
      expect(page().querySelector('[data-sessions-empty]')).toBeNull();
    });

    // The router reuses the page when the header switches to another unit's analytics.
    it('loads the new unit when the page is reused for another unit', async () => {
      await start(
        makeUnit(1, 'Convenor', () =>
          of([session({start: new Date(2026, 8, 10, 10), minutes: 30})]),
        ),
      );
      component.toggleTutor(7);

      const other = makeUnit(2, 'Convenor');
      fixture.componentRef.setInput('unit', other);
      fixture.detectChanges();

      expect(other.getUserMarkingSessions).toHaveBeenCalledTimes(1);
      expect(lastRequest(other)).toEqual([day(8, 8), day(8, 14)]);
      expect(component.selectedUserId).toBeNull();
      expect(component.events).toEqual([]);
    });
  });

  describe('calendar', () => {
    it('draws each session as a labelled button in the tutor colour', async () => {
      await start(
        makeUnit(1, 'Convenor', () =>
          of([session({start: new Date(2026, 8, 10, 10), minutes: 45})]),
        ),
      );

      const blocks = page().querySelectorAll<HTMLButtonElement>('button.analytics-session');
      expect(blocks.length).toBe(1);
      expect(blocks[0].getAttribute('aria-label')).toBe(
        'Ada, Thursday 10 September, 10:00 to 10:45, 45 minutes',
      );
      expect(blocks[0].style.getPropertyValue('--session-accent')).toBe('var(--ot-chart-1)');
      expect(blocks[0].getAttribute('role')).toBeNull();
    });

    // The old blocks said "(T)" for these. The first rewrite left it to the tooltip.
    it('marks a session during a tutorial on the block itself', async () => {
      await start(
        makeUnit(1, 'Convenor', () =>
          of([
            session({start: new Date(2026, 8, 10, 10), minutes: 45, duringTutorial: true}),
            session({start: new Date(2026, 8, 11, 10), minutes: 45}),
          ]),
        ),
      );

      const [tutorial, other] = Array.from(
        page().querySelectorAll<HTMLButtonElement>('button.analytics-session'),
      );
      expect(tutorial.classList).toContain('analytics-session--tutorial');
      expect(tutorial.textContent).toContain('in tutorial');
      expect(tutorial.getAttribute('aria-label')).toMatch(/, during a tutorial$/);
      expect(other.classList).not.toContain('analytics-session--tutorial');
      expect(other.textContent).not.toContain('in tutorial');
    });

    // The library header made every day a tab stop with nothing behind it.
    it('draws the days without tab stops and marks today', async () => {
      await start(
        makeUnit(1, 'Convenor', () =>
          of([session({start: new Date(2026, 8, 10, 10), minutes: 45})]),
        ),
      );

      const headers = page().querySelectorAll('.cal-day-headers [role="columnheader"]');
      expect(headers.length).toBe(7);
      expect(page().querySelectorAll('.cal-day-headers [tabindex]').length).toBe(0);

      const today = page().querySelector('.cal-day-headers [aria-current="date"]');
      expect(today?.textContent).toContain('14 Sep');
      expect(headers[0].textContent).toContain('8 Sep');
    });

    it('takes tutor colours from the chart tokens, never a fixed colour', async () => {
      await start(
        makeUnit(1, 'Convenor', () =>
          of([
            session({userId: 7, start: new Date(2026, 8, 9, 10), minutes: 30}),
            session({userId: 8, start: new Date(2026, 8, 9, 11), minutes: 30}),
            session({userId: 99, start: new Date(2026, 8, 9, 12), minutes: 30}),
          ]),
        ),
      );

      expect(component.events.map((e) => e.accent)).toEqual([
        'var(--ot-chart-1)',
        'var(--ot-chart-2)',
        'var(--ot-color-text-muted)',
      ]);
      expect(component.events[2].tutorName).toBe('Unknown tutor');
    });

    // new Date(null) is 1 January 1970, and the calendar warns about any event that ends
    // before it starts.
    it('ends a session with no end time where it starts, without a warning', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const open = {
        ...session({start: new Date(2026, 8, 9, 10), minutes: 5}),
        endTime: null,
      } as unknown as MarkingSession;
      await start(makeUnit(1, 'Convenor', () => of([open])));

      expect(component.events[0].end).toEqual(new Date(2026, 8, 9, 10));
      expect(component.events[0].endHour).toBe('10:00');
      expect(page().querySelector('button.analytics-session')).not.toBeNull();
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    describe('visible hours', () => {
      const hoursFor = async (sessions: MarkingSession[]): Promise<[number, number]> => {
        await start(makeUnit(1, 'Convenor', () => of(sessions)));
        return [component.dayStartHour, component.dayEndHour];
      };

      it('shows 8 am to 6 pm when every session fits inside it', async () => {
        expect(await hoursFor([session({start: new Date(2026, 8, 9, 10), minutes: 30})])).toEqual([
          8, 17,
        ]);
      });

      it('starts earlier for an early session', async () => {
        const early = session({start: new Date(2026, 8, 9, 6, 30), minutes: 45});
        expect(await hoursFor([early])).toEqual([6, 17]);
      });

      it('runs later for a late session, but not for one ending on the hour', async () => {
        const late = session({start: new Date(2026, 8, 9, 18), minutes: 30});
        expect(await hoursFor([late])).toEqual([8, 18]);
      });

      it('does not add a row for a session that ends exactly on the hour', async () => {
        const onTheHour = session({start: new Date(2026, 8, 9, 17), minutes: 60});
        expect(await hoursFor([onTheHour])).toEqual([8, 17]);
      });

      it('shows the whole day for a session that runs past midnight', async () => {
        const overnight = session({start: new Date(2026, 8, 9, 23, 30), minutes: 60});
        expect(await hoursFor([overnight])).toEqual([0, 23]);
      });
    });
  });

  describe('filters', () => {
    const twoTutors = () =>
      makeUnit(1, 'Convenor', () =>
        of([
          session({userId: 7, start: new Date(2026, 8, 9, 10), minutes: 30}),
          session({userId: 8, start: new Date(2026, 8, 9, 11), minutes: 90}),
          session({userId: 8, start: new Date(2026, 8, 10, 11), minutes: 20, duringTutorial: true}),
          session({userId: 8, start: new Date(2026, 8, 10, 15), minutes: 0}),
        ]),
      );

    it('leaves out sessions shorter than a minute, as before', async () => {
      await start(twoTutors());

      expect(component.filteredEvents.length).toBe(3);
      expect(page().querySelector('[data-range-total]')?.textContent).toContain(
        '3 sessions · 2 h 20 min of marking',
      );
    });

    it('hides sessions during tutorials when asked', async () => {
      await start(twoTutors());

      component.setHideSessionsDuringTutorials(true);

      expect(component.filteredEvents.every((e) => !e.duringTutorial)).toBe(true);
      expect(component.filteredEvents.length).toBe(2);
    });

    it('lists each tutor with their time, and a name shows only that tutor', async () => {
      await start(twoTutors());

      const chips = page().querySelectorAll<HTMLButtonElement>('[data-tutor-chip]');
      expect(Array.from(chips).map((c) => c.textContent.replace(/\s+/g, ' ').trim())).toEqual([
        'Ada 30 min',
        'Brian 1 h 50 min',
      ]);

      chips[1].click();
      fixture.detectChanges();
      expect(chips[1].getAttribute('aria-pressed')).toBe('true');
      expect(component.filteredEvents.every((e) => e.userId === 8)).toBe(true);
      // The legend keeps every tutor so another one can be picked.
      expect(page().querySelectorAll('[data-tutor-chip]').length).toBe(2);

      page().querySelector<HTMLButtonElement>('[data-show-everyone]').click();
      fixture.detectChanges();
      expect(component.selectedUserId).toBeNull();
      expect(component.filteredEvents.length).toBe(3);
    });

    it('toggles the tutor filter when a session is clicked, as before', async () => {
      await start(twoTutors());
      const brian = component.events[1] as SessionEvent;

      component.eventClicked({event: brian});
      expect(component.selectedUserId).toBe(8);

      component.eventClicked({event: component.events[0]});
      expect(component.selectedUserId).toBeNull();
    });

    it('has no legend when only one tutor has sessions', async () => {
      await start(
        makeUnit(1, 'Tutor', () =>
          of([session({userId: 7, start: new Date(2026, 8, 9, 10), minutes: 30})]),
        ),
      );

      expect(page().querySelector('[data-tutor-chip]')).toBeNull();
    });
  });

  describe('empty states', () => {
    it('says there are no sessions and offers the previous week', async () => {
      const unit = makeUnit(1, 'Convenor');
      await start(unit);

      const empty = page().querySelector('[data-sessions-empty]');
      expect(empty?.textContent).toContain('No marking sessions in these dates');
      expect(page().querySelector('mwl-calendar-week-view')).toBeNull();

      empty.querySelector('button').click();
      expect(lastRequest(unit)).toEqual([day(8, 1), day(8, 7)]);
    });

    it('says when the filters hide every session, and clears them', async () => {
      await start(
        makeUnit(1, 'Convenor', () =>
          of([session({start: new Date(2026, 8, 9, 10), minutes: 30, duringTutorial: true})]),
        ),
      );
      component.setHideSessionsDuringTutorials(true);
      fixture.detectChanges();

      const empty = page().querySelector('[data-sessions-empty]');
      expect(empty?.textContent).toContain('No sessions match the filters');

      empty.querySelector('button').click();
      fixture.detectChanges();
      expect(component.hideSessionsDuringTutorials).toBe(false);
      expect(page().querySelector('button.analytics-session')).not.toBeNull();
    });

    // The name came from the legend, which only lists tutors with sessions in these dates,
    // so this read "Every session in these dates was during a tutorial."
    it('names the picked tutor when the new dates have none of their sessions', async () => {
      let week = 0;
      await start(
        makeUnit(1, 'Convenor', () =>
          of(
            week++ === 0
              ? [session({userId: 8, start: new Date(2026, 8, 9, 10), minutes: 30})]
              : [session({userId: 7, start: new Date(2026, 8, 2, 10), minutes: 30})],
          ),
        ),
      );
      component.toggleTutor(8);
      component.goPreviousWeek();
      fixture.detectChanges();

      const empty = page().querySelector('[data-sessions-empty]');
      expect(empty?.textContent).toContain(
        'There are sessions in these dates, but none for Brian.',
      );
    });

    it('speaks to a tutor about their own sessions', async () => {
      await start(makeUnit(1, 'Tutor'));

      expect(page().querySelector('header p')?.textContent).toContain('The time you spent marking');
      expect(page().querySelector('[data-sessions-empty]')?.textContent).toContain(
        'when you open, comment on or assess',
      );
    });
  });

  describe('downloads', () => {
    it('offers the summary to convenors only, and my sessions to everyone', async () => {
      await start(makeUnit(1, 'Tutor'));
      expect(page().querySelector('[data-download-summary]')).toBeNull();
      expect(page().querySelector('[data-download-mine]')).not.toBeNull();

      fixture.componentRef.setInput('unit', makeUnit(2, 'Convenor'));
      fixture.detectChanges();
      expect(page().querySelector('[data-download-summary]')).not.toBeNull();
    });

    // It used to end in "-.csv" when tutorial sessions were left out.
    it('names the summary file for whether tutorial sessions are in it', async () => {
      const unit = makeUnit(1, 'Convenor');
      const downloadCsvFn = vi.fn();
      fixture.componentRef.setInput('downloadCsvFn', downloadCsvFn);
      await start(unit);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

      component.getTutorTimesSummary();
      expect(downloadCsvFn.mock.calls[0][2]).toBe(
        `COS10001-tutor-times-summary-2026-09-08-to-2026-09-14-${tz}-incl-tutorials.csv`,
      );

      component.setHideSessionsDuringTutorials(true);
      component.getTutorTimesSummary();
      expect(downloadCsvFn.mock.calls[1][2]).toBe(
        `COS10001-tutor-times-summary-2026-09-08-to-2026-09-14-${tz}-excl-tutorials.csv`,
      );
      expect(unit.downloadTutorTimesSummaryCsv).toHaveBeenLastCalledWith(
        day(8, 8),
        day(8, 14),
        tz,
        true,
      );
    });

    it('downloads my sessions for the dates on screen', async () => {
      const unit = makeUnit(1, 'Tutor');
      const downloadCsvFn = vi.fn();
      fixture.componentRef.setInput('downloadCsvFn', downloadCsvFn);
      await start(unit);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

      component.getMyTutorTimesSessions();

      expect(unit.downloadMyTutorTimeSessionsCsv).toHaveBeenCalledWith(day(8, 8), day(8, 14), tz);
      expect(downloadCsvFn).toHaveBeenCalledWith(
        expect.any(Observable),
        'marking sessions CSV',
        `COS10001-Ada Lovelace-sessions-2026-09-08-to-2026-09-14-${tz}.csv`,
      );
    });
  });
});
