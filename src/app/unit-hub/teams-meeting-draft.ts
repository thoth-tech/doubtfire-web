/** A snapshot of the editor. Times are resolved instants, not local input values. */
export interface TeamsMeetingDraft {
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  timezone: string;
  location?: string | null;
  recurrence?: 'none' | 'weekly';
  recurrence_until?: string | null;
  cancelled?: boolean;
}

export interface TeamsMeetingOptions {
  attendees?: string;
  content?: string;
}

// These are OnTrack's bounds for a portable draft URL, not Microsoft service limits.
export const TEAMS_MEETING_MAX_URL_LENGTH = 8000;
export const TEAMS_MEETING_MAX_ATTENDEES = 20;

function plainText(value: string, label: string, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum) {
    throw new Error(`${label} must be ${maximum} characters or fewer.`);
  }
  if (/\p{Cc}/u.test(value.replace(/[\r\n\t]/g, ''))) {
    throw new Error(`${label} contains unsupported characters.`);
  }
  return value.replace(/\r\n?/g, '\n').trim();
}

function instant(value: string): string {
  const match =
    typeof value === 'string' &&
    value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/);
  if (!match) {
    throw new Error('Set a complete start and end time, including the time zone.');
  }
  const wall = `${match[1]}:${match[2] || '00'}`;
  const wallDate = new Date(`${wall}Z`);
  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(wallDate.getTime()) ||
    wallDate.toISOString().slice(0, 19) !== wall
  ) {
    throw new Error('Set a valid start and end time.');
  }
  return date.toISOString();
}

export function teamsMeetingAttendees(value = ''): string[] {
  if (value.length > 5100) {
    throw new Error(`Add no more than ${TEAMS_MEETING_MAX_ATTENDEES} attendees.`);
  }
  const entries = value.trim() ? value.split(/[,;\n]+/).map((entry) => entry.trim()) : [];
  const attendees: string[] = [];
  const seen: Set<string> = new Set();
  for (const entry of entries) {
    const pieces = entry.split('@');
    const validDomain = pieces[1]
      ?.split('.')
      .every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label));
    if (
      entry.length > 254 ||
      pieces.length !== 2 ||
      !validDomain ||
      !/^[a-z\d.!#$%&'*+/=?^_`{|}~-]+$/i.test(pieces[0])
    ) {
      throw new Error('Enter university sign-in email addresses, separated by commas.');
    }
    const key = entry.toLowerCase();
    if (!seen.has(key)) {
      attendees.push(entry);
      seen.add(key);
    }
  }
  if (attendees.length > TEAMS_MEETING_MAX_ATTENDEES) {
    throw new Error(
      `Add no more than ${TEAMS_MEETING_MAX_ATTENDEES} attendees here; add others in Teams.`,
    );
  }
  return attendees;
}

export function teamsMeetingContent(draft: TeamsMeetingDraft, unitCode: string): string {
  const code = plainText(unitCode, 'Unit code', 50);
  // The API returns null when a session was saved without a description.
  const description = plainText(draft.description || '', 'Session details', 20000);
  const location = plainText(draft.location || '', 'Location', 300);
  return [code ? `Unit: ${code}` : '', description, location ? `Location: ${location}` : '']
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Open a scheduling draft only. This never creates a meeting or discovers a join URL.
 * https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/deep-link-workflow
 * Only documented fields are used. Recurrence and location are not URL parameters.
 */
export function teamsMeetingDraftUrl(
  draft: TeamsMeetingDraft,
  unitCode: string,
  options: TeamsMeetingOptions = {},
): string {
  if (!draft || draft.cancelled) {
    throw new Error('Use a scheduled session to prepare a Teams meeting.');
  }
  const title = plainText(draft.title, 'Session title', 200);
  const code = plainText(unitCode, 'Unit code', 50);
  if (!title || /[\r\n]/.test(title) || /[\r\n]/.test(code)) {
    throw new Error('Enter a session title on one line.');
  }
  const start = instant(draft.start_at);
  const end = instant(draft.end_at);
  if (new Date(end).getTime() <= new Date(start).getTime()) {
    throw new Error('The end time must be after the start time.');
  }
  try {
    new Intl.DateTimeFormat('en', {timeZone: draft.timezone}).format(new Date(start));
    if (!draft.timezone) {
      throw new Error();
    }
  } catch {
    throw new Error('Choose a valid session time zone.');
  }
  const defaultContent = teamsMeetingContent(draft, code);
  const content = plainText(options.content ?? defaultContent, 'Teams details', 20500);
  const attendees = teamsMeetingAttendees(options.attendees);
  const parameters: Record<string, string> = {
    subject: code ? `${code} · ${title}` : title,
    startTime: start,
    endTime: end,
    content,
  };
  if (attendees.length) {
    parameters.attendees = attendees.join(',');
  }
  // URLSearchParams uses + for spaces, which this Teams endpoint does not support.
  const query = Object.entries(parameters)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  const url = `https://teams.microsoft.com/l/meeting/new?${query}`;
  if (url.length > TEAMS_MEETING_MAX_URL_LENGTH) {
    throw new Error(
      'This draft is too long to open reliably. Shorten the Teams details or add attendees in Teams.',
    );
  }
  return url;
}
