import {CalendarEvent} from 'angular-calendar';
import {addDays, differenceInCalendarDays, format, isSameDay, startOfDay} from 'date-fns';
import {formatDate} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  Input,
  LOCALE_ID,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import {FormControl, FormGroup} from '@angular/forms';
import {Observable, Subscription} from 'rxjs';
import {MarkingSession} from 'src/app/api/models/marking-session';
import {SidekiqJob} from 'src/app/api/models/sidekiq-job';
import {Unit} from 'src/app/api/models/unit';
import {UserService} from 'src/app/api/services/user.service';
import {AlertService} from 'src/app/common/services/alert.service';

export interface SessionEvent extends CalendarEvent {
  startHour: string;
  endHour: string;
  userId: number;
  commentsAdded: number;
  assessments: number;
  submissionsOpened: number;
  duration: number;
  duringTutorial: boolean;
  tutorName: string;
  /** A chart colour token, so each tutor keeps one colour and it follows the theme. */
  accent: string;
}

export interface TutorSessionSummary {
  userId: number;
  name: string;
  accent: string;
  sessions: number;
  minutes: number;
}

/** The first and last hour rows the calendar shows when every session fits inside them. */
export const DEFAULT_DAY_START_HOUR = 8;
export const DEFAULT_DAY_END_HOUR = 17;

const DEFAULT_PERIOD_DAYS = 7;
const MAX_PERIOD_DAYS = 366;
// --ot-chart-1 to --ot-chart-6 in the token files.
const CHART_COLOUR_COUNT = 6;
const UNKNOWN_TUTOR_ACCENT = 'var(--ot-color-text-muted)';

@Component({
  selector: 'f-analytics-tutor-times',
  templateUrl: 'analytics-tutor-times.component.html',
  styleUrls: ['analytics-tutor-times.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AnalyticsTutorTimesComponent implements OnInit, OnChanges, OnDestroy {
  @Input() unit: Unit;

  @Input() downloadCsvFn!: (
    newJob: Observable<SidekiqJob>,
    title: string,
    filename: string,
  ) => void;

  selectedUserId: number | null = null;

  /** The first day on the calendar. */
  viewDate: Date;
  events: SessionEvent[] = [];
  filteredEvents: SessionEvent[] = [];
  /** One entry per tutor with sessions on screen, for the legend. */
  tutorSummaries: TutorSessionSummary[] = [];

  /** The first and last day shown, both at local midnight. The downloads use them too. */
  tutorTimeSummaryStartDate: Date;
  tutorTimeSummaryEndDate: Date;
  daysInWeek: number = DEFAULT_PERIOD_DAYS;

  dayStartHour = DEFAULT_DAY_START_HOUR;
  dayEndHour = DEFAULT_DAY_END_HOUR;

  hideSessionsDuringTutorials: boolean = false;

  /** What the date field shows. It only becomes the period once both ends are valid. */
  readonly dateRange = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  public isLoading: boolean = false;
  public loadError: string | null = null;

  private sessionsSub?: Subscription;
  private dateFieldsPending = false;

  constructor(
    private alertService: AlertService,
    private userService: UserService,
    @Inject(LOCALE_ID) private locale: string,
  ) {}

  get role() {
    return this.unit?.staff?.find((s) => s.user?.id === this.userService.currentUser?.id)?.role;
  }

  /** Tutors only get their own sessions back from the API, so the copy speaks to them. */
  get showsOnlyOwnSessions(): boolean {
    return this.role === 'Tutor';
  }

  ngOnInit(): void {
    this.goTodayWeek();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const unitChange = changes.unit;
    // The router reuses this page when the header switches to another unit's analytics,
    // so the new unit arrives here rather than through ngOnInit.
    if (
      unitChange &&
      !unitChange.firstChange &&
      unitChange.previousValue?.id !== unitChange.currentValue?.id
    ) {
      this.selectedUserId = null;
      this.loadSessions();
    }
  }

  ngOnDestroy(): void {
    this.sessionsSub?.unsubscribe();
  }

  goPreviousWeek() {
    this.setPeriod(addDays(this.tutorTimeSummaryStartDate, -this.daysInWeek), this.daysInWeek);
  }

  goNextWeek() {
    this.setPeriod(addDays(this.tutorTimeSummaryStartDate, this.daysInWeek), this.daysInWeek);
  }

  /** The seven days ending today. */
  goTodayWeek() {
    const today = startOfDay(new Date());
    this.setPeriod(addDays(today, 1 - DEFAULT_PERIOD_DAYS), DEFAULT_PERIOD_DAYS);
  }

  /** "week" for the usual seven days, otherwise the number of days, for button labels. */
  get periodName(): string {
    if (this.daysInWeek === 7) {
      return 'week';
    }
    return this.daysInWeek === 1 ? 'day' : `${this.daysInWeek} days`;
  }

  get rangeLabel(): string {
    const start = this.tutorTimeSummaryStartDate;
    const end = this.tutorTimeSummaryEndDate;
    if (!start || !end) {
      return '';
    }
    const day = (date: Date, pattern: string) => formatDate(date, pattern, this.locale);
    if (isSameDay(start, end)) {
      return day(start, 'd MMM y');
    }
    if (start.getFullYear() !== end.getFullYear()) {
      return `${day(start, 'd MMM y')} – ${day(end, 'd MMM y')}`;
    }
    if (start.getMonth() !== end.getMonth()) {
      return `${day(start, 'd MMM')} – ${day(end, 'd MMM y')}`;
    }
    return `${day(start, 'd')} – ${day(end, 'd MMM y')}`;
  }

  get totalMinutes(): number {
    return this.filteredEvents.reduce((total, e) => total + (e.duration || 0), 0);
  }

  get sessionCountLabel(): string {
    const count = this.filteredEvents.length;
    return count === 1 ? '1 session' : `${count} sessions`;
  }

  /**
   * Read from the staff list, not the legend, because the legend only lists tutors with
   * sessions in these dates and the picked tutor may have none.
   */
  get selectedTutorName(): string | undefined {
    if (this.selectedUserId === null) {
      return undefined;
    }
    const tutor = this.unit?.staff?.find((s) => s.user?.id === this.selectedUserId);
    return tutor?.user?.firstName ?? 'this tutor';
  }

  /** True when there are sessions in these dates but the filters hide all of them. */
  get sessionsHiddenByFilters(): boolean {
    return this.filteredEvents.length === 0 && this.events.some((e) => e.duration >= 1);
  }

  formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) {
      return `${rest} min`;
    }
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }

  setHideSessionsDuringTutorials(hide: boolean) {
    this.hideSessionsDuringTutorials = hide;
    this.applyFilters();
  }

  toggleTutor(userId: number | null | undefined) {
    if (userId == null) {
      return;
    }
    this.selectedUserId = this.selectedUserId === userId ? null : userId;
    this.applyFilters();
  }

  clearTutorFilter() {
    this.selectedUserId = null;
    this.applyFilters();
  }

  clearFilters() {
    this.selectedUserId = null;
    this.hideSessionsDuringTutorials = false;
    this.applyFilters();
  }

  applyFilters() {
    const shown = this.events.filter(
      (e) => e.duration >= 1 && (!this.hideSessionsDuringTutorials || !e.duringTutorial),
    );
    this.tutorSummaries = this.summariseByTutor(shown);
    this.filteredEvents = shown.filter(
      (e) => this.selectedUserId === null || e.userId === this.selectedUserId,
    );
    // Sized from every shown session, not just the picked tutor's, so the grid holds
    // still when someone clicks through the tutors.
    this.fitHoursTo(shown);
  }

  /**
   * Runs when either end of the date field changes, typed or picked. A click in the picker
   * sets the first day and then clears the last, announcing each in turn, so reading the
   * field straight away paired the new first day with the old last day, applied that and
   * closed the picker. The field is read once both ends have landed.
   */
  onDateChange() {
    if (this.dateFieldsPending) {
      return;
    }
    this.dateFieldsPending = true;
    Promise.resolve().then(() => {
      this.dateFieldsPending = false;
      this.applyDateFields();
    });
  }

  /** Makes the dates in the field the period, once both ends are there and valid. */
  applyDateFields() {
    const {start, end} = this.dateRange.getRawValue();
    if (!start || !end) {
      // The picker is still waiting for the last day.
      return;
    }

    // Includes both the first and the last day.
    const days = differenceInCalendarDays(end, start) + 1;

    if (days > MAX_PERIOD_DAYS) {
      this.alertService.error('You cannot select more than a year', 3000);
      this.resetDateFields();
      return;
    }
    if (days < 1) {
      this.alertService.error('End date must be on or after the start date');
      this.resetDateFields();
      return;
    }
    const unchanged =
      this.tutorTimeSummaryStartDate &&
      days === this.daysInWeek &&
      isSameDay(start, this.tutorTimeSummaryStartDate);
    if (unchanged) {
      return;
    }
    this.setPeriod(start, days);
  }

  /** Closing the picker half way leaves the field showing the period again. */
  onRangePickerClosed() {
    const {start, end} = this.dateRange.getRawValue();
    if (!start || !end) {
      this.resetDateFields();
    }
  }

  public getTutorTimesSummary() {
    const tz = this.timezone;
    const tutorials = this.hideSessionsDuringTutorials ? 'excl-tutorials' : 'incl-tutorials';

    this.downloadCsvFn?.(
      this.unit.downloadTutorTimesSummaryCsv(
        this.tutorTimeSummaryStartDate,
        this.tutorTimeSummaryEndDate,
        tz,
        this.hideSessionsDuringTutorials,
      ),
      'tutor times summary CSV',
      `${this.unit.code}-tutor-times-summary-${this.fileDates}-${tz}-${tutorials}.csv`,
    );
  }

  public getMyTutorTimesSessions() {
    const tz = this.timezone;
    const name = this.userService.currentUser?.name ?? 'my';

    this.downloadCsvFn?.(
      this.unit.downloadMyTutorTimeSessionsCsv(
        this.tutorTimeSummaryStartDate,
        this.tutorTimeSummaryEndDate,
        tz,
      ),
      'marking sessions CSV',
      `${this.unit.code}-${name}-sessions-${this.fileDates}-${tz}.csv`,
    );
  }

  public loadSessions() {
    if (!this.unit || !this.tutorTimeSummaryStartDate || !this.tutorTimeSummaryEndDate) {
      return;
    }

    // Drop any request still running for dates the calendar has moved away from, so a
    // slow answer cannot land on top of the newer one.
    this.sessionsSub?.unsubscribe();

    this.isLoading = true;
    this.loadError = null;
    this.events = [];
    this.applyFilters();

    this.sessionsSub = this.unit
      .getUserMarkingSessions(
        this.tutorTimeSummaryStartDate,
        this.tutorTimeSummaryEndDate,
        this.timezone,
      )
      .subscribe({
        next: (sessions) => {
          this.isLoading = false;
          this.events = (sessions ?? [])
            .map((session) => this.toSessionEvent(session))
            .filter((event) => !Number.isNaN(event.start.getTime()));
          this.applyFilters();
        },
        error: (error) => {
          this.isLoading = false;
          this.loadError = `${error ?? 'Something went wrong.'}`;
        },
      });
  }

  eventClicked({event}: {event: CalendarEvent; sourceEvent?: MouseEvent | KeyboardEvent}): void {
    if (!this.isSessionEvent(event)) {
      return;
    }

    if (event.userId !== undefined && event.userId !== null) {
      if (this.selectedUserId === null) {
        this.selectedUserId = Number(event.userId);
      } else {
        this.selectedUserId = null;
      }
      this.applyFilters();
    }
  }

  sessionEventTitle(event: SessionEvent): string {
    return [
      `${event.tutorName} (${event.duration} minutes)`,
      `${event.startHour} - ${event.endHour}`,
      `Assessments: ${event.assessments || 0}`,
      `Comments: ${event.commentsAdded || 0}`,
      `Submissions opened: ${event.submissionsOpened || 0}`,
      `During a tutorial: ${event.duringTutorial ? 'yes' : 'no'}`,
    ].join('\n');
  }

  sessionAriaLabel(event: SessionEvent): string {
    const day = formatDate(event.start, 'EEEE d MMMM', this.locale);
    const tutorial = event.duringTutorial ? ', during a tutorial' : '';
    return `${event.tutorName}, ${day}, ${event.startHour} to ${event.endHour}, ${event.duration} minutes${tutorial}`;
  }

  private setPeriod(start: Date, days: number) {
    this.daysInWeek = days;
    // Whole calendar days, not 24 hour steps, so a daylight saving change cannot pull
    // the period onto the wrong day.
    this.tutorTimeSummaryStartDate = startOfDay(start);
    this.tutorTimeSummaryEndDate = addDays(this.tutorTimeSummaryStartDate, days - 1);
    this.viewDate = this.tutorTimeSummaryStartDate;
    this.resetDateFields();
    this.loadSessions();
  }

  private resetDateFields() {
    this.dateRange.setValue(
      {start: this.tutorTimeSummaryStartDate ?? null, end: this.tutorTimeSummaryEndDate ?? null},
      {emitEvent: false},
    );
  }

  private get timezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  private get fileDates(): string {
    const day = (date: Date) => format(date, 'yyyy-MM-dd');
    return `${day(this.tutorTimeSummaryStartDate)}-to-${day(this.tutorTimeSummaryEndDate)}`;
  }

  private toSessionEvent(session: MarkingSession): SessionEvent {
    const staff = this.unit?.staff ?? [];
    const staffIndex = staff.findIndex((s) => s.user?.id === session.user?.id);
    const tutor = staffIndex >= 0 ? staff[staffIndex] : undefined;
    const name = tutor?.user?.firstName ?? 'Unknown tutor';
    const start = new Date(session.startTime);
    const recordedEnd = session.endTime ? new Date(session.endTime) : undefined;
    // A session still being written can come back without an end. new Date(null) is 1970,
    // which the calendar rejects with a console warning, so it ends where it starts.
    const end = recordedEnd && recordedEnd >= start ? recordedEnd : start;

    return {
      id: session.id,
      start,
      end,
      title: `${name} (${session.durationMinutes} minutes)`,
      startHour: this.formatTime(start),
      endHour: this.formatTime(end),
      userId: session.user?.id,
      commentsAdded: session.commentsAdded,
      assessments: session.assessments,
      submissionsOpened: session.submissionsOpened,
      duration: session.durationMinutes,
      duringTutorial: session.duringTutorial,
      tutorName: name,
      // Keyed to the tutor's place in the staff list, so a tutor keeps the same colour
      // from one week to the next.
      accent: tutor
        ? `var(--ot-chart-${(staffIndex % CHART_COLOUR_COUNT) + 1})`
        : UNKNOWN_TUTOR_ACCENT,
    };
  }

  private formatTime(date: Date): string {
    return Number.isNaN(date.getTime()) ? '' : formatDate(date, 'HH:mm', this.locale);
  }

  /**
   * Starts the grid at 8 am and ends it after the 5 pm row, then widens it to take in any
   * session outside those hours. Before this the grid always ran from midnight, so the
   * working day sat a screen below the top.
   */
  private fitHoursTo(sessions: SessionEvent[]) {
    let first = DEFAULT_DAY_START_HOUR;
    let last = DEFAULT_DAY_END_HOUR;

    for (const session of sessions) {
      const start = session.start;
      const end = session.end && session.end > start ? session.end : start;
      // The last minute the session covers, so one ending on the hour needs no extra row.
      const lastMinute = end > start ? new Date(end.getTime() - 1) : start;

      if (!isSameDay(start, lastMinute)) {
        // It runs past midnight, so both ends of the day are needed.
        first = 0;
        last = 23;
        break;
      }
      first = Math.min(first, start.getHours());
      last = Math.max(last, lastMinute.getHours());
    }

    this.dayStartHour = first;
    this.dayEndHour = last;
  }

  private summariseByTutor(sessions: SessionEvent[]): TutorSessionSummary[] {
    const byTutor: Map<number, TutorSessionSummary> = new Map();
    for (const session of sessions) {
      if (session.userId === undefined || session.userId === null) {
        continue;
      }
      const summary = byTutor.get(session.userId) ?? {
        userId: session.userId,
        name: session.tutorName,
        accent: session.accent,
        sessions: 0,
        minutes: 0,
      };
      summary.sessions += 1;
      summary.minutes += session.duration || 0;
      byTutor.set(session.userId, summary);
    }
    return [...byTutor.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private isSessionEvent(event: CalendarEvent): event is SessionEvent {
    return 'userId' in event && 'duration' in event;
  }
}
