import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import API_URL from 'src/app/config/constants/apiUrl';
import {DEMO_TOOLS_AVAILABLE, DemoModeStore} from 'src/app/demo/demo-mode.store';
import {DemoMeetingLinksStore} from '../demo/demo-meeting-links.store';
import {unitHubDemo} from './unit-hub-demo.fixtures';
import {AnnouncementInput, SessionInput, UnitHubFeed} from './unit-hub.models';
import {UnitHubService, scopeHubFeed} from './unit-hub.service';

const announcement: AnnouncementInput = {
  title: 'Update',
  body: 'Bring questions',
  pinned: false,
  published_at: null,
};
const session = unitHubDemo().sessions[0] as SessionInput;

describe('Unit Hub API and demo isolation', () => {
  let service: UnitHubService;
  let http: HttpTestingController;
  let demo: DemoModeStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {provide: DEMO_TOOLS_AVAILABLE, useValue: true},
      ],
    });
    service = TestBed.inject(UnitHubService);
    http = TestBed.inject(HttpTestingController);
    demo = TestBed.inject(DemoModeStore);
    // The demo store only switches on for a loaded demo scenario.
    demo.configureScenario('all-features', 111);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('normal mode reads real content when the available demo is switched off', () => {
    expect(demo.available).toBe(true);
    expect(demo.enabled).toBe(false);
    let result: UnitHubFeed;
    service.feed().subscribe((value) => (result = value));
    http.expectOne(`${API_URL}/unit_hub`).flush(unitHubDemo());
    expect(result.units.map((unit) => unit.id)).toEqual([111]);
    expect(result.announcements.every((row) => row.unit_id === 111)).toBe(true);
    expect(result.sessions.every((row) => row.unit_id === 111)).toBe(true);
  });

  it('demo mode uses a synthetic enrolled-unit scope without reading the API', () => {
    demo.setEnabled(true);
    service.feed().subscribe((feed) => {
      expect(feed.units.map((unit) => unit.code)).toEqual(['SIT111']);
      expect(feed.announcements.length).toBe(2);
      expect(feed.sessions.length).toBe(3);
      expect(feed.announcements.some((row) => row.unit_id === 102)).toBe(false);
    });
    http.expectNone(`${API_URL}/unit_hub`);
  });

  it('checks demo mode when an operation is subscribed, not when it was created', () => {
    const pending = service.saveAnnouncement(111, announcement);
    demo.setEnabled(true);
    const errors = vi.fn();
    pending.subscribe({error: errors});
    expect(errors).toHaveBeenCalledOnce();
    http.expectNone(`${API_URL}/units/111/announcements`);
  });

  it('uses hosted links only in opted-in demo HelpHubs, without API reads or altering live rows', () => {
    const link = 'https://teams.microsoft.com/meet/12345?p=demo';
    TestBed.inject(DemoMeetingLinksStore).save({helpHub: link, extraHelpHub: ''});
    demo.setEnabled(true);
    service.feed().subscribe((feed) => {
      expect(feed.sessions[0].join_url).toBe(link);
      expect(feed.sessions[0].demo_hosted_join).toBe(true);
      expect(feed.sessions.filter((row) => row.demo_hosted_join)).toHaveLength(1);
      expect(feed.sessions.find((row) => row.kind === 'lecture').join_url).toBeNull();
    });
    http.expectNone(`${API_URL}/unit_hub`);
    demo.setEnabled(false);
    service.feed().subscribe((feed) => {
      expect(feed.sessions[0].join_url).toBeNull();
      expect(feed.sessions[0].demo_hosted_join).toBe(false);
    });
    http.expectOne(`${API_URL}/unit_hub`).flush(unitHubDemo());
  });

  it('blocks every staff read and write in demo mode', () => {
    demo.setEnabled(true);
    const errors = vi.fn();
    [
      service.announcements(111),
      service.sessions(111),
      service.saveAnnouncement(111, announcement),
      service.saveAnnouncement(111, announcement, 1),
      service.saveSession(111, session),
      service.saveSession(111, session, 1),
      service.remove(111, 'sessions', 1),
      service.remove(111, 'announcements', 1),
    ].forEach((operation) => operation.subscribe({error: errors}));
    expect(errors).toHaveBeenCalledTimes(8);
    http.expectNone((request) => request.url.includes('/units/'));
  });

  it('cancels live reads and writes when demo mode changes', () => {
    const next = vi.fn();
    service.feed().subscribe(next);
    service.saveSession(111, session).subscribe(next);
    const read = http.expectOne(`${API_URL}/unit_hub`);
    const write = http.expectOne(`${API_URL}/units/111/sessions`);
    demo.setEnabled(true);
    expect(read.cancelled).toBe(true);
    expect(write.cancelled).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it('matches the server wrappers, HTTP methods and unit-scoped paths', () => {
    service.saveAnnouncement(111, announcement).subscribe();
    const created = http.expectOne(`${API_URL}/units/111/announcements`);
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual({announcement});
    created.flush({id: 1});
    service.saveSession(111, session, 12).subscribe();
    const updated = http.expectOne(`${API_URL}/units/111/sessions/12`);
    expect(updated.request.method).toBe('PUT');
    expect(updated.request.body).toEqual({session});
    updated.flush({id: 12});
    service.remove(111, 'sessions', 12).subscribe();
    const removed = http.expectOne(`${API_URL}/units/111/sessions/12`);
    expect(removed.request.method).toBe('DELETE');
    removed.flush({success: true});
  });

  it('cannot enable fixtures in builds without demo tools', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {provide: DEMO_TOOLS_AVAILABLE, useValue: false},
      ],
    });
    demo = TestBed.inject(DemoModeStore);
    service = TestBed.inject(UnitHubService);
    http = TestBed.inject(HttpTestingController);
    demo.configureScenario('unit-hub-spec', 1);
    demo.setEnabled(true);
    expect(demo.enabled).toBe(false);
    service.feed().subscribe();
    http.expectOne(`${API_URL}/unit_hub`).flush({units: [], sessions: [], announcements: []});
  });

  it('drops unsafe joining/source links, invalid dates and cross-unit records while preserving display limits', () => {
    const source = unitHubDemo();
    source.sessions[0].join_url = 'javascript:alert(1)';
    source.sessions[0].source_url = 'https://user:secret@example.com';
    source.sessions[1].start_at = 'invalid';
    const result = scopeHubFeed({
      ...source,
      announcements_truncated: true,
      window_end: '2026-12-01',
    });
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0].join_url).toBeNull();
    expect(result.sessions[0].source_url).toBeNull();
    expect(result.announcements_truncated).toBe(true);
    expect(result.window_end).toBe('2026-12-01');
  });
});
