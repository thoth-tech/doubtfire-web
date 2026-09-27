import {LearningSession} from './unit-hub.models';

/** How far ahead a session counts as starting soon. */
export const SOON_WINDOW_MS = 60 * 60 * 1000;

export type SessionTimingState = 'cancelled' | 'now' | 'soon' | 'today' | 'none';

export interface SessionTiming {
  state: SessionTimingState;
  /** Whole minutes until the start, for a session starting soon. */
  minutes?: number;
}

type Timed = Pick<LearningSession, 'start_at' | 'end_at' | 'cancelled'>;

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Where a session sits relative to now. Cancelled sessions never get a time highlight.
 * now: start <= now < end. soon: starts within the next 60 minutes. today: later today.
 */
export function sessionTiming(session: Timed, now: number): SessionTiming {
  if (session.cancelled) {
    return {state: 'cancelled'};
  }
  const start = Date.parse(session.start_at);
  const end = Date.parse(session.end_at);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return {state: 'none'};
  }
  if (start <= now && now < end) {
    return {state: 'now'};
  }
  if (start > now && start - now <= SOON_WINDOW_MS) {
    return {state: 'soon', minutes: Math.max(1, Math.ceil((start - now) / 60000))};
  }
  if (start > now && sameLocalDay(new Date(start), new Date(now))) {
    return {state: 'today'};
  }
  return {state: 'none'};
}

/** The next session to show: happening now, or the earliest one still to start. Never cancelled. */
export function upNextSession<T extends Timed>(sessions: readonly T[], now: number): T | null {
  let next: T | null = null;
  for (const session of sessions) {
    const start = Date.parse(session.start_at);
    const end = Date.parse(session.end_at);
    if (session.cancelled || !Number.isFinite(start) || !(end > now)) {
      continue;
    }
    if (!next || start < Date.parse(next.start_at)) {
      next = session;
    }
  }
  return next;
}
