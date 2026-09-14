import {describe, expect, it} from 'vitest';
import {
  TEAMS_MEETING_MAX_URL_LENGTH,
  TeamsMeetingDraft,
  teamsMeetingAttendees,
  teamsMeetingContent,
  teamsMeetingDraftUrl,
} from './teams-meeting-draft';
import {dateTimeToIso} from './unit-hub-calendar';

const session = (): TeamsMeetingDraft => ({
  title: 'Hardware questions & answers',
  description: 'Bring your circuit questions.\nWe will discuss the next task.',
  start_at: '2026-09-17T17:00:00+10:00',
  end_at: '2026-09-17T18:00:00+10:00',
  timezone: 'Australia/Melbourne',
  location: 'Online',
  recurrence: 'none',
});

describe('Teams meeting draft URLs', () => {
  it('uses the supported HTTPS scheduling endpoint and only documented parameters', () => {
    const value = teamsMeetingDraftUrl(session(), 'SIT111');
    const url = new URL(value);
    expect(url.origin + url.pathname).toBe('https://teams.microsoft.com/l/meeting/new');
    expect([...url.searchParams.keys()]).toEqual(['subject', 'startTime', 'endTime', 'content']);
    expect(url.searchParams.get('subject')).toBe('SIT111 · Hardware questions & answers');
    expect(url.searchParams.get('startTime')).toBe('2026-09-17T07:00:00.000Z');
    expect(url.searchParams.get('endTime')).toBe('2026-09-17T08:00:00.000Z');
    expect(url.searchParams.get('content')).toContain('Location: Online');
    expect(value).toContain('%20');
    expect(value).not.toContain('+');
  });

  it('converts Melbourne summer time without depending on the device time zone', () => {
    const draft = {
      ...session(),
      start_at: dateTimeToIso('2026-10-08T17:00', 'Australia/Melbourne'),
      end_at: dateTimeToIso('2026-10-08T18:00', 'Australia/Melbourne'),
    };
    const url = new URL(teamsMeetingDraftUrl(draft, 'SIT111'));
    expect(url.searchParams.get('startTime')).toBe('2026-10-08T06:00:00.000Z');
    expect(url.searchParams.get('endTime')).toBe('2026-10-08T07:00:00.000Z');
  });

  it('handles half-hour offsets and an end time on the next local day', () => {
    const draft = {
      ...session(),
      timezone: 'Asia/Kolkata',
      start_at: '2026-09-17T23:30:00+05:30',
      end_at: '2026-09-18T00:30:00+05:30',
    };
    const url = new URL(teamsMeetingDraftUrl(draft, 'SIT111'));
    expect(url.searchParams.get('startTime')).toBe('2026-09-17T18:00:00.000Z');
    expect(url.searchParams.get('endTime')).toBe('2026-09-17T19:00:00.000Z');
  });

  it.each([
    '2026-09-17T17:00',
    '2026-02-30T17:00:00Z',
    '2026-09-17T24:00:00Z',
    '2026-09-17T17:00:60Z',
    'not a date',
  ])('rejects an invalid or unzoned time: %s', (value) => {
    expect(() => teamsMeetingDraftUrl({...session(), start_at: value}, 'SIT111')).toThrow();
  });

  it('rejects cancelled sessions, backwards times and invalid time zones', () => {
    expect(() => teamsMeetingDraftUrl({...session(), cancelled: true}, 'SIT111')).toThrow(
      /scheduled/,
    );
    expect(() =>
      teamsMeetingDraftUrl({...session(), end_at: session().start_at}, 'SIT111'),
    ).toThrow(/after/);
    expect(() => teamsMeetingDraftUrl({...session(), timezone: 'Mars/Anywhere'}, 'SIT111')).toThrow(
      /time zone/,
    );
    expect(() => teamsMeetingDraftUrl({...session(), timezone: ''}, 'SIT111')).toThrow(/time zone/);
  });

  it('encodes query delimiters, literal plus signs and Unicode as data', () => {
    const draft = {
      ...session(),
      title: 'C++ & 电路 #1',
      description: '<b>Review</b> &attendees=other@example.edu',
    };
    const url = new URL(
      teamsMeetingDraftUrl(draft, 'SIT111', {attendees: 'person+lab@example.edu'}),
    );
    expect([...url.searchParams.keys()]).toHaveLength(5);
    expect(url.searchParams.get('subject')).toBe('SIT111 · C++ & 电路 #1');
    expect(url.searchParams.get('content')).toContain('<b>Review</b> &attendees=other@example.edu');
    expect(url.searchParams.get('attendees')).toBe('person+lab@example.edu');
    expect(url.hash).toBe('');
  });

  it('accepts explicit Entra UPNs, removes duplicates and omits empty attendees', () => {
    expect(teamsMeetingAttendees('A@example.edu; b@example.edu\nA@EXAMPLE.edu')).toEqual([
      'A@example.edu',
      'b@example.edu',
    ]);
    expect(
      new URL(teamsMeetingDraftUrl(session(), 'SIT111', {attendees: ' '})).searchParams.has(
        'attendees',
      ),
    ).toBe(false);
    expect(teamsMeetingAttendees('guest_example.com#EXT#@tenant.onmicrosoft.com')).toHaveLength(1);
  });

  it.each([
    'Display Name <a@example.edu>',
    'a@example.edu&content=bad',
    'a@-bad.edu',
    'a@example..edu',
    'a@example.edu,',
    'a@example.edu\r\nBcc: b@example.edu',
  ])('rejects malformed attendee input: %s', (value) => {
    expect(() => teamsMeetingAttendees(value)).toThrow(/sign-in/);
  });

  it('bounds attendees and URL length without silently losing details', () => {
    const many = Array.from({length: 21}, (_, i) => `person${i}@example.edu`).join(',');
    expect(() => teamsMeetingAttendees(many)).toThrow(/20 attendees/);
    const draft = {...session(), description: '🙂'.repeat(1500)};
    expect(() => teamsMeetingDraftUrl(draft, 'SIT111')).toThrow(/too long/);
    const shortened = teamsMeetingDraftUrl(draft, 'SIT111', {content: 'Short draft details'});
    expect(shortened.length).toBeLessThanOrEqual(TEAMS_MEETING_MAX_URL_LENGTH);
    expect(draft.description).toHaveLength(3000);
  });

  it('never copies an existing join URL, source URL or invents recurrence parameters', () => {
    const draft = {
      ...session(),
      recurrence: 'weekly' as const,
      recurrence_until: '2026-11-26',
      join_url: 'https://teams.microsoft.com/l/meetup-join/existing',
      source_url: 'https://example.edu/private',
    };
    const url = new URL(teamsMeetingDraftUrl(draft, 'SIT111'));
    expect(url.searchParams.has('recurrence')).toBe(false);
    expect(url.searchParams.has('location')).toBe(false);
    expect(url.searchParams.get('content')).not.toContain('https://');
  });

  it('rejects control characters and overlong fields while preserving ordinary line breaks', () => {
    expect(teamsMeetingContent({...session(), description: 'First\r\nSecond'}, 'SIT111')).toContain(
      'First\nSecond',
    );
    expect(() => teamsMeetingDraftUrl({...session(), title: 'bad\nsubject'}, 'SIT111')).toThrow(
      /one line/,
    );
    expect(() =>
      teamsMeetingDraftUrl({...session(), description: 'bad\u0000text'}, 'SIT111'),
    ).toThrow(/characters/);
    expect(() => teamsMeetingDraftUrl({...session(), title: 'x'.repeat(201)}, 'SIT111')).toThrow(
      /200/,
    );
  });

  it('opens a draft for an API session saved without a description', () => {
    const draft = {...session(), description: null as unknown as string, location: null};
    expect(teamsMeetingContent(draft, 'SIT111')).toBe('Unit: SIT111');
    const url = new URL(teamsMeetingDraftUrl(draft, 'SIT111'));
    expect(url.searchParams.get('content')).toBe('Unit: SIT111');
  });
});
