import {LearningSession} from './unit-hub.models';

export function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value || /[\p{Cc}\s]/u.test(value)) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function utcStamp(value: string | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('This session has an invalid date.');
  }
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function validSession(session: LearningSession): void {
  if (
    session.cancelled ||
    new Date(session.end_at).getTime() <= new Date(session.start_at).getTime()
  ) {
    throw new Error('Only scheduled sessions with a valid end time can be added.');
  }
}

export function googleSessionUrl(session: LearningSession, unitCode: string): string {
  validSession(session);
  const details = [
    session.description,
    safeHttpsUrl(session.join_url),
    safeHttpsUrl(session.source_url),
  ]
    .filter(Boolean)
    .join('\n\n');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${unitCode} · ${session.title}`,
    dates: `${utcStamp(session.start_at)}/${utcStamp(session.end_at)}`,
    details,
    location: session.location || safeHttpsUrl(session.join_url) || 'Online',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\p{Cc}/gu, '');
}

/** RFC 5545 lines are folded at 75 UTF-8 octets, without breaking a code point. */
function foldIcs(line: string): string {
  const encoder = new TextEncoder();
  let folded = '';
  let octets = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (octets + size > 75) {
      folded += '\r\n ';
      octets = 1;
    }
    folded += character;
    octets += size;
  }
  return folded;
}

export function sessionIcs(
  session: LearningSession,
  unitCode: string,
  now = new Date(),
  namespace: 'live' | 'demo' = 'live',
): string {
  validSession(session);
  const start = utcStamp(session.start_at);
  const description = [
    session.description,
    safeHttpsUrl(session.join_url),
    safeHttpsUrl(session.source_url),
  ]
    .filter(Boolean)
    .join('\n\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OnTrack//Unit Hub//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${namespace === 'demo' ? 'demo-' : ''}unit-${session.unit_id}-session-${session.id}-${start}@ontrack`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${start}`,
    `DTEND:${utcStamp(session.end_at)}`,
    `SUMMARY:${escapeIcs(`${unitCode} · ${session.title}`)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(session.location || safeHttpsUrl(session.join_url) || 'Online')}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .map(foldIcs)
    .join('\r\n');
}

export function dateTimeInZone(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

/** Resolve a wall-clock value in its named time zone. Reject DST gaps and ambiguous times. */
export function dateTimeToIso(value: string, timeZone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error('Enter a complete date and time.');
  }
  const wallClock = new Date(`${value}:00Z`).getTime();
  if (!Number.isFinite(wallClock)) {
    throw new Error('Enter a valid date and time.');
  }
  const offsets: Set<number> = new Set();
  for (const delta of [-86400000, 0, 86400000]) {
    const sample = wallClock + delta;
    const local = dateTimeInZone(new Date(sample).toISOString(), timeZone);
    offsets.add(new Date(`${local}:00Z`).getTime() - sample);
  }
  const candidates = [...offsets]
    .map((offset) => new Date(wallClock - offset).toISOString())
    .filter((candidate) => dateTimeInZone(candidate, timeZone) === value);
  if (candidates.length !== 1) {
    throw new Error(
      'This time is missing or repeated when clocks change. Choose a different time.',
    );
  }
  return candidates[0];
}
