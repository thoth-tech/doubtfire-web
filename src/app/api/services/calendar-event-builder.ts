import {Task} from '../models/task';

export interface WebCalEvent {
  /**
   * Raw, unescaped event title: "{unit.code}: {taskDef.abbreviation}: {taskDef.name}".
   * Matches webcal.rb's event_name_for_task_definition bare-name case (no Start:/End: prefix).
   * Deliberately not escaped for any target format, since URL encoding and ICS text escaping
   * are incompatible schemes over the same string. Each consumer (CAL-F01, CAL-F02) must
   * escape this for its own protocol at the point of use. Note for CAL-F02 specifically: the
   * Ruby icalendar gem that auto-escapes text values for webcal.rb's own ICS output only exists
   * on that Rails side. CAL-F02 is a frontend consumer, so it gets no escaping for free from
   * that gem, it must implement RFC 5545 text escaping (backslash, comma, semicolon, newline)
   * itself.
   *
   * Also for CAL-F02: webcal.rb pairs this same "E-{taskDefinitionId}" UID with a different
   * title when the user's webcal has include_start_dates on, prefixing "End: " onto the name
   * (webcal.rb:63-69). This builder always emits the bare name, so the (uid, title) pair it
   * produces matches WebCal's own feed only for users who have include_start_dates off. CAL-F02
   * must not assume this pairing is universal.
   */
  title: string;

  /**
   * Civil date, 'YYYY-MM-DD', not a Date instant and not a start/end pair.
   *
   * Not a start/end pair: webcal.rb sets DTEND == DTSTART for its ICS output, while Google
   * Calendar's TEMPLATE URL needs an exclusive end date one day later. Those two conventions
   * are incompatible, so there is no one (start, end) pair that would be correct for both
   * consumers. Consumers derive their own end value from this single date. Do not "fix" this
   * into a date range.
   *
   * Not a Date instant: Task.localDueDate()'s fallback branches do not agree on time-of-day.
   * Task.dueDate, Task.targetDueDate and TaskDefinition.targetDate all map through
   * MappingFunctions.mapDateToEndOfDay (23:59:59.999 local), but the flexible-dates grade
   * lookup (TaskDefinition.gradeTargetDate, via gradeDueDates[].targetDueDate) maps through
   * mapDateToDay (00:00:00.000 local) instead. A consumer calling toISOString().slice(0, 10)
   * on the raw Date would get the previous day specifically on that branch, in any timezone
   * ahead of UTC. Extracting the local calendar date once here, at the source, means every
   * consumer works from the same civil date regardless of which branch produced it.
   */
  date: string;

  /**
   * ICS-consumer-only. Mirrors webcal.rb's "E-{taskDefinitionId}" scheme, keyed on the task
   * definition, not the task instance, so every student on the same task shares this UID. This
   * is WebCal's existing behaviour, matched here deliberately, not a bug to fix. Google
   * Calendar's TEMPLATE URL has no identifier parameter, so CAL-F01 cannot use this field.
   */
  uid: string;
}

function toCivilDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Builds a calendar event description for a single student's task, matching WebCal's event
 * format (see webcal.rb) so events built here look identical to the existing WebCal feed.
 * Returns null when the task has no resolvable due date, since a calendar event with no date
 * is meaningless. Callers use the null case to hide calendar-related UI, not as an error.
 *
 * Task.localDueDate() is not itself null-safe on every branch: on a flexible-dates unit, a
 * Task with no project set throws when it dereferences this.project.targetGrade, rather than
 * returning a falsy value. That is a gap in localDueDate()'s own contract, not something this
 * function reimplements or works around by duplicating its fallback logic, it is only caught
 * here so this function's own null contract holds for every input.
 */
export function buildCalendarEvent(task: Task): WebCalEvent | null {
  let dueDate: Date;
  try {
    dueDate = task.localDueDate();
  } catch {
    return null;
  }

  if (!dueDate || Number.isNaN(dueDate.valueOf())) {
    return null;
  }

  return {
    title: `${task.unit.code}: ${task.definition.abbreviation}: ${task.definition.name}`,
    date: toCivilDateString(dueDate),
    uid: `E-${task.definition.id}`,
  };
}
