import {describe, expect, it} from 'vitest';
import {sessionTiming, upNextSession} from './session-timing';

const at = (iso: string) => Date.parse(iso);
const session = (start: string, end: string, cancelled = false, id = 1) => ({
  id,
  start_at: new Date(start).toISOString(),
  end_at: new Date(end).toISOString(),
  cancelled,
});

describe('Unit Hub session timing', () => {
  // local times, so "today" follows the device's day like the page does
  const now = at('2026-09-16T10:00:00');

  it('classifies happening now, starting soon, later today and cancelled', () => {
    expect(sessionTiming(session('2026-09-16T09:30:00', '2026-09-16T10:30:00'), now)).toEqual({
      state: 'now',
    });
    expect(sessionTiming(session('2026-09-16T10:25:00', '2026-09-16T11:00:00'), now)).toEqual({
      state: 'soon',
      minutes: 25,
    });
    expect(sessionTiming(session('2026-09-16T11:00:00', '2026-09-16T12:00:00'), now).minutes).toBe(
      60,
    );
    expect(sessionTiming(session('2026-09-16T11:01:00', '2026-09-16T12:00:00'), now)).toEqual({
      state: 'today',
    });
    expect(sessionTiming(session('2026-09-17T09:00:00', '2026-09-17T10:00:00'), now)).toEqual({
      state: 'none',
    });
    // ended sessions and the exact end instant are not live
    expect(sessionTiming(session('2026-09-16T09:00:00', '2026-09-16T10:00:00'), now).state).toBe(
      'none',
    );
    expect(
      sessionTiming(session('2026-09-16T09:30:00', '2026-09-16T10:30:00', true), now).state,
    ).toBe('cancelled');
    expect(
      sessionTiming(session('2026-09-16T10:10:00', '2026-09-16T11:00:00', true), now).state,
    ).toBe('cancelled');
  });

  it('picks the live or earliest upcoming session that is not cancelled for Up next', () => {
    const ended = session('2026-09-16T08:00:00', '2026-09-16T09:00:00', false, 1);
    const cancelledSoon = session('2026-09-16T10:05:00', '2026-09-16T11:00:00', true, 2);
    const later = session('2026-09-17T09:00:00', '2026-09-17T10:00:00', false, 3);
    const soon = session('2026-09-16T10:30:00', '2026-09-16T11:30:00', false, 4);
    expect(upNextSession([ended, cancelledSoon, later, soon], now)?.id).toBe(4);
    const live = session('2026-09-16T09:45:00', '2026-09-16T10:15:00', false, 5);
    expect(upNextSession([later, soon, live], now)?.id).toBe(5);
    expect(upNextSession([ended, cancelledSoon], now)).toBeNull();
  });
});
