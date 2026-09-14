import {describe, expect, it} from 'vitest';
import {
  dateTimeInZone,
  dateTimeToIso,
  googleSessionUrl,
  safeHttpsUrl,
  sessionIcs,
} from './unit-hub-calendar';
import {unitHubDemo} from './unit-hub-demo.fixtures';

const session = {
  ...unitHubDemo().sessions[0],
  start_at: '2026-09-17T17:00:00+10:00',
  end_at: '2026-09-17T18:00:00+10:00',
  title: 'HelpHub & questions / hardware',
  join_url: 'https://teams.microsoft.com/l/meetup-join/abc?context=%7B%22Tid%22%3A%22x%22%7D',
};

describe('Unit Hub calendar exports and time zones', () => {
  it('encodes a one-off Google draft with exact UTC times and an intact joining URL', () => {
    const url = new URL(googleSessionUrl(session, 'SIT111'));
    expect(url.origin).toBe('https://calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20260917T070000Z/20260917T080000Z');
    expect(url.searchParams.get('text')).toBe('SIT111 · HelpHub & questions / hardware');
    expect(url.searchParams.get('details')).toContain(session.join_url);
    expect(url.searchParams.has('recur')).toBe(false);
  });

  it('creates a timed ICS event with stable identity and end time', () => {
    const ics = sessionIcs(session, 'SIT111', new Date('2026-09-01T00:00:00Z'));
    expect(ics).toContain('DTSTART:20260917T070000Z\r\nDTEND:20260917T080000Z');
    expect(ics).toContain('UID:unit-111-session-1-20260917T070000Z@ontrack');
    expect(ics).toContain('DTSTAMP:20260901T000000Z');
    expect(ics).not.toContain('VALUE=DATE');
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  it('escapes injected ICS lines and folds Unicode without splitting code points', () => {
    const ics = sessionIcs(
      {
        ...session,
        title: '界'.repeat(60),
        description: 'Hello\r\nEND:VEVENT\r\nBEGIN:VEVENT;attacker,hello',
      },
      'SIT111',
    );
    expect(ics.split('\r\n').filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(ics).toContain('Hello\\nEND:VEVENT\\nBEGIN:VEVENT\\;attacker\\,hello');
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(ics).not.toContain('�');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    '//evil.example/a',
    'http://teams.example/a',
    'https://u:p@example.com',
    'https://example.com/\nattack',
  ])('rejects unsafe URL %s', (url) => {
    expect(safeHttpsUrl(url)).toBeNull();
  });

  it.each([
    ['2026-09-17T17:00', '2026-09-17T07:00:00.000Z'],
    ['2026-10-08T17:00', '2026-10-08T06:00:00.000Z'],
  ])('resolves Melbourne local time %s across daylight saving', (local, iso) => {
    expect(dateTimeToIso(local, 'Australia/Melbourne')).toBe(iso);
    expect(dateTimeInZone(iso, 'Australia/Melbourne')).toBe(local);
  });

  it('rejects missing or repeated wall-clock times instead of silently moving a meeting', () => {
    expect(() => dateTimeToIso('2026-10-04T02:30', 'Australia/Melbourne')).toThrow('clocks change');
    expect(() => dateTimeToIso('2026-04-05T02:30', 'Australia/Melbourne')).toThrow('clocks change');
    expect(() => dateTimeToIso('2026-02-30T10:00', 'Australia/Melbourne')).toThrow();
  });

  it('gives demo calendar copies a separate UID from real sessions', () => {
    const now = new Date('2026-09-14T00:00:00Z');
    const demo = sessionIcs(session, 'SIT111', now, 'demo');
    const live = sessionIcs(session, 'SIT111', now);
    expect(demo).toContain('UID:demo-unit-111-session-1');
    expect(live).toContain('UID:unit-111-session-1');
    expect(demo).not.toContain('UID:unit-111-session-1');
  });

  it('does not export a cancelled or reversed session', () => {
    expect(() => googleSessionUrl({...session, cancelled: true}, 'SIT111')).toThrow();
    expect(() => sessionIcs({...session, end_at: session.start_at}, 'SIT111')).toThrow();
  });
});
