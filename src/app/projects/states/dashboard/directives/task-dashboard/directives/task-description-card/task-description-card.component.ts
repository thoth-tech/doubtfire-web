import {
  ChangeDetectionStrategy,
  Component,
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

@Component({
  selector: 'f-task-description-card',
  templateUrl: 'task-description-card.component.html',
  styleUrls: ['task-description-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskDescriptionCardComponent {
  @Output() switchView$: EventEmitter<string> = new EventEmitter();

  @Input() task: Task;
  @Input() taskDef: TaskDefinition;
  @Input() unit: Unit;

  public grades: {
    names: GradeService['grades'];
    acronyms: GradeService['gradeAcronyms'];
  };

  constructor(
    private GradeService: GradeService,
    @Inject(FileDownloaderService) private fileDownloader: FileDownloaderService,
  ) {
    this.grades = {
      names: GradeService.grades,
      acronyms: GradeService.gradeAcronyms,
    };
  }

  public downloadTaskSheet() {
    this.fileDownloader.downloadFile(
      this.taskDef.getTaskPDFUrl(true),
      `${this.unit.code}-${this.taskDef.abbreviation}-TaskSheet.pdf`,
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
    if (this.task) {
      return this.task.localDeadlineDate();
    }
    return this.taskDef?.localDeadlineDate();
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
