import {Task} from '../models/task';
import {buildCalendarEvent} from './calendar-event-builder';

const DEFAULT_PRODID = '-//Doubtfire//Calendar Download//EN';
const MAX_CONTENT_LINE_BYTES = 75;
const utf8Encoder = new TextEncoder();

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function formatIcsDate(civilDate: string): string {
  return civilDate.replaceAll('-', '');
}

function nextCivilDate(civilDate: string): string {
  const [year, month, day] = civilDate.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day + 1);

  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Folds a content line at 75 UTF-8 octets without splitting a Unicode code point.
 * Continuation lines start with a space, which counts toward their 75-octet limit.
 */
function foldIcsLine(line: string): string[] {
  const folded: string[] = [];
  let segment = '';
  let segmentBytes = 0;

  for (const character of line) {
    const characterBytes = utf8Encoder.encode(character).length;
    if (segment && segmentBytes + characterBytes > MAX_CONTENT_LINE_BYTES) {
      folded.push(segment);
      segment = ` ${character}`;
      segmentBytes = 1 + characterBytes;
    } else {
      segment += character;
      segmentBytes += characterBytes;
    }
  }

  folded.push(segment);
  return folded;
}

function formatIcsTimestamp(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

/**
 * Builds a VCALENDAR string, one VEVENT per task with a resolvable due date. Tasks
 * buildCalendarEvent cannot resolve a date for are skipped, not an error, matching
 * buildCalendarEvent's own null contract, not something reimplemented here. A pure function,
 * not a service and not inlined into any component, so CAL-F08's modal download can reuse it
 * directly.
 *
 * DTSTART is the task's due date and DTEND is the following date because RFC 5545 defines
 * DTEND as exclusive and requires it to be later than DTSTART. STATUS:CONFIRMED and the
 * X-DOUBTFIRE-UNIT / X-DOUBTFIRE-TASK custom properties are set per VEVENT, read from the task
 * itself so every event is correctly attributed even if the tasks span more than one unit.
 */
export function buildIcsCalendar(
  tasks: readonly Task[],
  now: Date = new Date(),
  productName: string = DEFAULT_PRODID,
): string {
  const dtstamp = formatIcsTimestamp(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${escapeIcsText(productName)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const task of tasks) {
    const event = buildCalendarEvent(task);
    if (!event) {
      continue;
    }

    const startDate = formatIcsDate(event.date);
    const endDate = formatIcsDate(nextCivilDate(event.date));

    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      'STATUS:CONFIRMED',
      `DTSTART;VALUE=DATE:${startDate}`,
      `DTEND;VALUE=DATE:${endDate}`,
      `DTSTAMP:${dtstamp}`,
      `X-DOUBTFIRE-UNIT:${task.unit.id}`,
      `X-DOUBTFIRE-TASK:${task.definition.id}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  return lines.flatMap(foldIcsLine).join('\r\n') + '\r\n';
}
