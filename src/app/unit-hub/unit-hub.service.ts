import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable, defer, map, of, skip, takeUntil, throwError} from 'rxjs';
import API_URL from 'src/app/config/constants/apiUrl';
import {DemoMeetingLinksStore} from 'src/app/demo/demo-meeting-links.store';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {safeHttpsUrl} from './unit-hub-calendar';
import {unitHubDemo} from './unit-hub-demo.fixtures';
import {
  AnnouncementInput,
  LearningSession,
  SessionInput,
  UnitAnnouncement,
  UnitHubFeed,
} from './unit-hub.models';

/** Defence in depth; the API must enforce enrolment before returning any content. */
export function scopeHubFeed(feed: UnitHubFeed): UnitHubFeed {
  const units = feed.units ?? [];
  const allowed = new Set(units.map((unit) => unit.id));
  return {
    announcements_truncated: feed.announcements_truncated,
    window_start: feed.window_start,
    window_end: feed.window_end,
    units,
    announcements: (feed.announcements ?? [])
      .filter((row) => allowed.has(row.unit_id))
      .map((row) => ({
        ...row,
        source_url: safeHttpsUrl(row.source_url),
      })),
    sessions: (feed.sessions ?? [])
      .filter((row) => allowed.has(row.unit_id))
      .filter(
        (row) =>
          Number.isFinite(Date.parse(row.start_at)) &&
          Date.parse(row.end_at) > Date.parse(row.start_at),
      )
      .map((row) => ({
        ...row,
        join_url: row.cancelled ? null : safeHttpsUrl(row.join_url),
        source_url: safeHttpsUrl(row.source_url),
      })),
  };
}

@Injectable({providedIn: 'root'})
export class UnitHubService {
  constructor(
    private http: HttpClient,
    private demo: DemoModeStore,
    private demoLinks: DemoMeetingLinksStore,
  ) {}

  feed(): Observable<UnitHubFeed> {
    return defer(() =>
      this.demo.enabled
        ? of(unitHubDemo(new Date(), this.demoLinks.links))
        : this.http.get<UnitHubFeed>(`${API_URL}/unit_hub`),
    ).pipe(map(scopeHubFeed), takeUntil(this.modeChanged()));
  }

  announcements(unitId: number): Observable<UnitAnnouncement[]> {
    return this.live(() =>
      this.http.get<UnitAnnouncement[]>(`${API_URL}/units/${unitId}/announcements`),
    );
  }

  sessions(unitId: number): Observable<LearningSession[]> {
    return this.live(() => this.http.get<LearningSession[]>(`${API_URL}/units/${unitId}/sessions`));
  }

  saveAnnouncement(
    unitId: number,
    input: AnnouncementInput,
    id?: number,
  ): Observable<UnitAnnouncement> {
    const url = `${API_URL}/units/${unitId}/announcements${id ? `/${id}` : ''}`;
    return this.live(() =>
      id
        ? this.http.put<UnitAnnouncement>(url, {announcement: input})
        : this.http.post<UnitAnnouncement>(url, {announcement: input}),
    );
  }

  saveSession(unitId: number, input: SessionInput, id?: number): Observable<LearningSession> {
    const url = `${API_URL}/units/${unitId}/sessions${id ? `/${id}` : ''}`;
    return this.live(() =>
      id
        ? this.http.put<LearningSession>(url, {session: input})
        : this.http.post<LearningSession>(url, {session: input}),
    );
  }

  remove(unitId: number, kind: 'announcements' | 'sessions', id: number): Observable<unknown> {
    return this.live(() => this.http.delete(`${API_URL}/units/${unitId}/${kind}/${id}`));
  }

  private modeChanged(): Observable<boolean> {
    return this.demo.enabled$.pipe(skip(1));
  }

  private live<T>(request: () => Observable<T>): Observable<T> {
    return defer(() =>
      this.demo.enabled
        ? throwError(() => new Error('Demo content cannot change live data.'))
        : request(),
    ).pipe(takeUntil(this.modeChanged()));
  }
}
