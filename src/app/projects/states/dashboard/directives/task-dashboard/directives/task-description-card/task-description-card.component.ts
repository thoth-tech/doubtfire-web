import {
  ChangeDetectionStrategy,
  Component,
  DoCheck,
  EventEmitter,
  Inject,
  Input,
  Output,
} from '@angular/core';
import {Task, TaskDefinition, Unit} from 'src/app/api/models/doubtfire-model';
import {WebCalEvent, buildCalendarEvent} from 'src/app/api/services/calendar-event-builder';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {GradeService} from 'src/app/common/services/grade.service';

function formatGoogleCalendarDate(civilDate: string): string {
  return civilDate.replaceAll('-', '');
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const daysByMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysByMonth[month - 1];
}

/**
 * Adds one day to a 'YYYY-MM-DD' civil date using plain integer arithmetic, with no Date
 * object and no timezone involved anywhere. A civil date has no time-of-day, so it needs
 * no DST awareness, this sidesteps the DST bug entirely rather than working around it.
 * MappingFunctions.addDays previously did this step by adding a fixed 86,400,000 ms to a
 * Date instant, which lands on the wrong calendar day across a DST transition, confirmed
 * for a task due the day before Melbourne's October transition, see the spec for CAL-F01.
 */
function addOneCivilDay(civilDate: string): string {
  let [year, month, day] = civilDate.split('-').map(Number);

  day += 1;
  if (day > daysInMonth(year, month)) {
    day = 1;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Builds a Google Calendar "add event" link from a calendar event snapshot. The dates
 * range end is exclusive, one day after the event's date, since that is what Google's
 * all-day date range expects. This is a different convention to webcal.rb's ICS output,
 * which sets DTEND == DTSTART for the same single day, see calendar-event-builder.ts for
 * why those two conventions cannot share one date pair. formatGoogleCalendarDate is
 * calibrated for this URL only, CAL-F02's ICS output must not reuse it.
 */
function buildGoogleCalendarUrl(event: WebCalEvent): string {
  const start = formatGoogleCalendarDate(event.date);
  const end = formatGoogleCalendarDate(addOneCivilDay(event.date));

  const params = [
    ['action', 'TEMPLATE'],
    ['text', event.title],
    ['dates', `${start}/${end}`],
  ]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return `https://calendar.google.com/calendar/render?${params}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** One date on the description card's timeline. */
export interface TaskKeyDate {
  key: 'start' | 'due' | 'feedback';
  label: string;
  date: Date;
  passed: boolean;
  /** The first date still to come, while the task is still the student's to work on. */
  next: boolean;
  /** When the next date is, in words, such as "In 3 days". Only set on the next date. */
  when?: string;
  /** An extension on the due date, in words. */
  note?: string;
  /** A planned submit date after the feedback date, which means no feedback. */
  warning?: string;
  /** How much of the time between this date and the following one has gone, 0 to 1. */
  progress: number;
}

function isValidDate(value: Date | undefined | null): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/** Calendar days from today to the date, so a date later today is "Today". */
function describeWhen(date: Date, now: Date): string {
  const days = Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS);
  if (days <= 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Tomorrow';
  }
  if (days < 14) {
    return `In ${days} days`;
  }
  return `In ${Math.floor(days / 7)} weeks`;
}

@Component({
  selector: 'f-task-description-card',
  templateUrl: 'task-description-card.component.html',
  styleUrls: ['task-description-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskDescriptionCardComponent implements DoCheck {
  @Output() switchView$: EventEmitter<string> = new EventEmitter();

  @Input() task: Task;
  @Input() taskDef: TaskDefinition;
  @Input() unit: Unit;

  public grades: {
    names: GradeService['grades'];
    acronyms: GradeService['gradeAcronyms'];
  };

  /**
   * The time the timeline is drawn for. Read once per change detection pass, in
   * ngDoCheck, so the development-mode second check sees the same value and the
   * countdown and the line never change between the two checks.
   */
  private now = Date.now();

  constructor(
    private GradeService: GradeService,
    @Inject(FileDownloaderService) private fileDownloader: FileDownloaderService,
  ) {
    this.grades = {
      names: GradeService.grades,
      acronyms: GradeService.gradeAcronyms,
    };
  }

  ngDoCheck(): void {
    this.now = Date.now();
  }

  public downloadTaskSheet() {
    this.fileDownloader.downloadFile(
      this.taskDef.getTaskPDFUrl(true),
      this.taskDef.effectiveTaskSheetFilename,
    );
  }

  public viewTaskSheet() {
    this.switchView$.emit('task');
  }

  public downloadResources() {
    this.fileDownloader.downloadFile(
      this.taskDef.getTaskResourcesUrl(true),
      `${this.unit.code}-${this.taskDef.abbreviation}-TaskResources.zip`,
    );
  }

  public dueDate(): Date {
    if (this.task) {
      return this.task.localDueDate();
    } else if (this.taskDef) {
      return this.taskDef.targetDate;
    } else {
      return undefined;
    }
  }

  public startDate(): Date {
    return this.task?.startDate ?? this.taskDef?.startDate;
  }

  public feedbackDate(): Date {
    // The task's deadline adds the project's special consideration days, so it needs
    // the project; without one, fall back to the definition's own deadline.
    if (this.task) {
      try {
        return this.task.localDeadlineDate();
      } catch {
        // An incompletely mapped task can still use its definition's deadline.
      }
    }
    try {
      return this.taskDef?.localDeadlineDate();
    } catch {
      return undefined;
    }
  }

  public get allowsFlexibleDates(): boolean {
    return !!(this.unit?.allowFlexibleDates ?? this.taskDef?.unit?.allowFlexibleDates);
  }

  /**
   * Start, due and feedback dates in order, for the timeline on the card. Dates the
   * task does not have are left out. Once the task is submitted or finished the
   * dates stay as a record, without a "next" date or a countdown.
   */
  public get keyDates(): TaskKeyDate[] {
    const flexible = this.allowsFlexibleDates;
    const extensions = this.task?.extensions ?? 0;
    const dueDate = this.dueDate();
    const feedbackDate = this.feedbackDate();
    const submitsTooLate =
      flexible &&
      isValidDate(dueDate) &&
      isValidDate(feedbackDate) &&
      dueDate.getTime() > feedbackDate.getTime();

    const candidates: Pick<TaskKeyDate, 'key' | 'label' | 'date' | 'note' | 'warning'>[] = [
      {key: 'start', label: flexible ? 'Planned start' : 'Start', date: this.startDate()},
      {
        key: 'due',
        label: flexible ? 'Planned submit' : 'Due',
        date: dueDate,
        note:
          extensions > 0 ? `Extended ${extensions} week${extensions > 1 ? 's' : ''}` : undefined,
        warning: submitsTooLate ? 'After the feedback date' : undefined,
      },
      {key: 'feedback', label: 'Feedback by', date: feedbackDate},
    ];

    // In date order, so the line reads left to right in time. A planned submit
    // date can fall after the feedback date, and then it is drawn after it.
    const entries = candidates
      .filter((entry) => isValidDate(entry.date))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const nowMs = this.now;
    const now = new Date(nowMs);
    const settled = !this.task || this.task.inSubmittedState() || this.task.inFinalState();
    let nextFound = settled;

    return entries.map((entry, index) => {
      const time = entry.date.getTime();
      const passed = time < nowMs;
      const next = !passed && !nextFound;
      nextFound ||= next;

      const following = entries[index + 1]?.date.getTime();
      let progress = 0;
      if (following !== undefined) {
        progress =
          following > time
            ? Math.min(Math.max((nowMs - time) / (following - time), 0), 1)
            : Number(nowMs >= following);
      }

      return {
        ...entry,
        passed,
        next,
        when: next ? describeWhen(entry.date, now) : undefined,
        progress,
      };
    });
  }

  public shouldShowDeadline(): boolean {
    return this.task && this.task.daysUntilDeadlineDate() <= 14;
  }

  /**
   * Google Calendar's TEMPLATE link has no identifier parameter, so this always opens a
   * fresh "add event" dialog rather than updating an existing calendar entry. The date is
   * a snapshot of the due date at click time and will not track later changes. That is
   * inherent to this mechanism, not a defect.
   *
   * Task entities are updated in place when planned dates or extensions change, so this
   * derives the URL from the current task state instead of caching it by object identity.
   * The template aliases this getter in its @if block, so it is evaluated only once per
   * change detection pass for both visibility and href.
   */
  public get googleCalendarUrl(): string | null {
    if (!this.task) {
      return null;
    }

    const event = buildCalendarEvent(this.task);
    return event ? buildGoogleCalendarUrl(event) : null;
  }

  /**
   * An <a> responds natively to Enter but not Space. Binds plain (keydown) rather than
   * Angular's (keydown.space) modifier syntax, since the template type checker cannot
   * infer KeyboardEvent through that modifier and falls back to the plain Event type,
   * this way the parameter is genuinely typed as KeyboardEvent with no cast needed.
   * Navigates directly with window.open rather than simulating a click on the anchor,
   * since googleCalendarUrl is already a typed string here, no DOM element reference or
   * type narrowing is needed to use it. The noopener,noreferrer window features match
   * the anchor's own rel attribute.
   */
  public handleCalendarLinkKeydown(event: KeyboardEvent): void {
    if (event.key !== ' ') {
      return;
    }

    event.preventDefault();
    if (this.googleCalendarUrl) {
      window.open(this.googleCalendarUrl, '_blank', 'noopener,noreferrer');
    }
  }
}
