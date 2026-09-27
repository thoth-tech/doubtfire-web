import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Router, provideRouter} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {Subject, of, throwError} from 'rxjs';
import {UserService} from 'src/app/api/services/user.service';
import {routes} from 'src/app/app.routes';
import {roleWhitelistGuard} from 'src/app/common/guards/role-whitelist.guard';
import {CalendarModalService} from 'src/app/common/modals/calendar-modal/calendar-modal.service';
import {DEMO_TOOLS_AVAILABLE, DemoModeStore} from 'src/app/demo/demo-mode.store';
import {unitHubDemo} from './unit-hub-demo.fixtures';
import {UnitHubDetailsComponent} from './unit-hub-details.component';
import {UnitHubComponent} from './unit-hub.component';
import {UnitHubService, scopeHubFeed} from './unit-hub.service';

function memoryStorage(): Storage {
  const values: Map<string, string> = new Map();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, String(value)),
  };
}

const feed = () => scopeHubFeed(unitHubDemo(new Date('2026-09-14T06:00:00Z')));

describe('Unit Hub route, forms and rendered content', () => {
  let service: {
    feed: ReturnType<typeof vi.fn>;
    announcements: ReturnType<typeof vi.fn>;
    sessions: ReturnType<typeof vi.fn>;
    saveAnnouncement: ReturnType<typeof vi.fn>;
    saveSession: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let calendars: {show: ReturnType<typeof vi.fn>};
  let demo: DemoModeStore;
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: memoryStorage()});
    service = {
      feed: vi.fn().mockImplementation(() => of(feed())),
      announcements: vi.fn().mockReturnValue(of([])),
      sessions: vi.fn().mockReturnValue(of([])),
      saveAnnouncement: vi.fn().mockReturnValue(of({id: 5})),
      saveSession: vi.fn().mockReturnValue(of({id: 5})),
      remove: vi.fn().mockReturnValue(of({success: true})),
    };
    calendars = {show: vi.fn()};
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{path: 'unit-hub', component: UnitHubComponent}]),
        {provide: UnitHubService, useValue: service},
        {provide: CalendarModalService, useValue: calendars},
        {provide: DEMO_TOOLS_AVAILABLE, useValue: true},
        {provide: UserService, useValue: {currentUser: {id: 7}}},
      ],
    });
    demo = TestBed.inject(DemoModeStore);
    // The demo store only switches on for a loaded demo scenario.
    demo.configureScenario('all-features', 111);
  });
  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  async function open(url = '/unit-hub') {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(url, UnitHubComponent);
    harness.detectChanges();
    return {harness, component, element: harness.routeNativeElement as HTMLElement};
  }

  it('has a reachable lazy route restricted to recognised account roles', async () => {
    const route = routes.find((item) => item.path === 'unit-hub');
    expect(route.loadComponent).toBeDefined();
    expect(route.canActivate).toContain(roleWhitelistGuard);
    expect(route.data.roleWhitelist).toContain('Student');
    const {element} = await open();
    expect(element.querySelector('h1')?.textContent).toBe('Unit Hub');
    expect(element.textContent).toContain('Computer Systems HelpHub');
    expect(element.textContent).not.toContain('SIT102 HelpHub must stay hidden');
    expect(element.textContent).not.toContain('Manage updates');
  });

  it('keeps the named hub section inside the app-owned main landmark', async () => {
    const {element} = await open();
    expect(element.querySelector('main, [role="main"]')).toBeNull();
    const section = element.querySelector('section.unit-hub');
    expect(section.getAttribute('aria-labelledby')).toBe('unit-hub-title');
    expect(section.querySelector('#unit-hub-title').textContent).toBe('Unit Hub');
  });

  it('unknown unit deep links reveal no other unit content and show a useful message', async () => {
    const {component, element} = await open('/unit-hub?unit=102');
    expect(component.sessions).toEqual([]);
    expect(component.announcements).toEqual([]);
    expect(element.textContent).toContain('This unit is not available to your account');
    expect(element.textContent).not.toContain('Computer Systems HelpHub');
  });

  it('switches update type from the visible controls', async () => {
    const {harness, element} = await open();
    const button = Array.from(element.querySelectorAll('nav button')).find(
      (item) => item.textContent?.trim() === 'Sessions',
    ) as HTMLButtonElement;
    button.click();
    harness.detectChanges();
    expect(element.querySelector('#announcements-title')).toBeNull();
    expect(element.querySelector('#sessions-title')).not.toBeNull();
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders announcement text without interpreting HTML', async () => {
    const data = feed();
    data.announcements[0].body = '<img src=x onerror=alert(1)> Please review your tasks.';
    service.feed.mockReturnValue(of(data));
    const {element} = await open();
    expect(element.querySelector('.announcement-card img')).toBeNull();
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>');
    const link = element.querySelector('a[href^="https://calendar.google.com"]');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('clears failed feeds, offers retry and shows the genuine empty state after recovery', async () => {
    service.feed
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({units: [], announcements: [], sessions: []}));
    const {harness, component, element} = await open();
    expect(element.textContent).toContain('Updates are unavailable');
    expect(component.sessions).toEqual([]);
    const retry = Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent.trim().endsWith('Try again'),
    );
    retry.click();
    harness.detectChanges();
    expect(element.textContent).toContain('No active units to show');
  });

  it('demo Google drafts are marked fictional, omit joining links and never open subscription settings', async () => {
    demo.setEnabled(true);
    const {component, element} = await open();
    const link = element.querySelector(
      'a[href^="https://calendar.google.com"]',
    ) as HTMLAnchorElement;
    const url = new URL(link.href);
    expect(url.searchParams.get('text')).toContain('DEMO');
    expect(url.searchParams.get('details')).toContain('FICTIONAL ONTRACK DEMO');
    expect(url.searchParams.get('details')).not.toContain('https://');
    expect(url.searchParams.get('location')).toBe('Fictional demo only');
    expect(element.querySelector('a[href*="example.invalid"]')).toBeNull();
    component.openCalendar();
    expect(calendars.show).not.toHaveBeenCalled();
    component.toggleManage();
    expect(service.announcements).not.toHaveBeenCalled();
    expect(service.sessions).not.toHaveBeenCalled();
  });

  it('cancelled occurrences offer no join or export actions', async () => {
    const data = feed();
    data.sessions = [{...data.sessions[0], cancelled: true}];
    service.feed.mockReturnValue(of(data));
    const {element} = await open();
    const card = element.querySelector('.session-card');
    expect(card.textContent).toContain('Cancelled');
    expect(card.querySelector('a[href^="https://calendar.google.com"]')).toBeNull();
    expect(card.querySelector('a[href*="example.invalid"]')).toBeNull();
  });

  async function openManager() {
    const data = feed();
    data.units[0].can_manage = true;
    service.feed.mockReturnValue(of(data));
    const result = await open();
    result.component.toggleManage();
    result.harness.detectChanges();
    return result;
  }

  it('shows configured Teams imports as read-only and links staff back to their source', async () => {
    const data = feed();
    data.units[0].can_manage = true;
    data.units[0].teams_sync = 'configured';
    const imported = {
      ...data.announcements[0],
      source_provider: 'microsoft_teams' as const,
      managed_externally: true,
      source_url: 'https://teams.microsoft.com/l/message/example',
    };
    service.feed.mockReturnValue(of(data));
    service.announcements.mockReturnValue(of([imported]));
    const {component, harness, element} = await open();
    component.toggleManage();
    harness.detectChanges();
    expect(element.textContent).toContain('Automatic Teams announcements are configured');
    expect(
      element.querySelector('a[href="https://teams.microsoft.com/l/message/example"]')?.textContent,
    ).toContain('Manage in Teams');
    expect(element.querySelector(`button[aria-label="Edit ${imported.title}"]`)).toBeNull();
    component.editAnnouncement(imported);
    expect(component.editor).toBeNull();
    component.deleteCandidate = {id: imported.id, title: imported.title, kind: 'announcements'};
    component.confirmRemove();
    expect(service.remove).not.toHaveBeenCalled();
  });

  it('does not imply that Microsoft sign-in alone enables a Teams connection', async () => {
    const {element} = await openManager();
    const text = element.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('Microsoft sign-in alone does not turn that connection on.');
    expect(text).not.toContain('Automatic Teams announcements are configured');
  });

  it('labels imported announcements for students without showing account or tenant details', async () => {
    const data = feed();
    data.announcements[0].source_provider = 'microsoft_teams';
    service.feed.mockReturnValue(of(data));
    const {element} = await open();
    expect(element.querySelector('.announcement-card')?.textContent).toContain('From Teams');
    expect(element.textContent).not.toContain('Manage in Teams');
  });

  it('staff can create a draft announcement only inside a manageable unit', async () => {
    const {component, harness, element} = await openManager();
    component.editAnnouncement();
    harness.detectChanges();
    expect(element.querySelector('label[for="announcement-title"]')).not.toBeNull();
    component.announcementForm.patchValue({
      title: 'Week update',
      body: 'Bring questions',
      published: false,
    });
    component.save();
    expect(service.saveAnnouncement).toHaveBeenCalledWith(
      111,
      expect.objectContaining({title: 'Week update', published_at: null}),
      undefined,
    );
    component.managedUnitId = 102;
    component.editSession();
    expect(component.editor).toBeNull();
  });

  it('staff session form converts the chosen time zone and preserves weekly rules', async () => {
    const {component} = await openManager();
    component.editSession();
    component.sessionForm.patchValue({
      title: 'HelpHub',
      start_at: '2026-10-08T17:00',
      end_at: '2026-10-08T18:00',
      timezone: 'Australia/Melbourne',
      recurrence: 'weekly',
      recurrence_until: '2026-11-05',
      published: true,
      join_url: 'https://teams.microsoft.com/example',
    });
    component.save();
    expect(service.saveSession).toHaveBeenCalledWith(
      111,
      expect.objectContaining({
        start_at: '2026-10-08T06:00:00.000Z',
        end_at: '2026-10-08T07:00:00.000Z',
        timezone: 'Australia/Melbourne',
        recurrence: 'weekly',
        recurrence_until: '2026-11-05',
      }),
      undefined,
    );
  });

  it('invalid dates and unsafe links never reach the write endpoint', async () => {
    const {component} = await openManager();
    component.editSession();
    component.sessionForm.patchValue({
      title: 'HelpHub',
      start_at: '2026-10-04T02:30',
      end_at: '2026-10-04T04:00',
    });
    component.save();
    expect(component.formError).toContain('clocks change');
    expect(service.saveSession).not.toHaveBeenCalled();
    component.editAnnouncement();
    component.announcementForm.patchValue({
      title: 'Update',
      body: 'Hello',
      source_url: 'javascript:alert(1)',
    });
    component.save();
    expect(component.formError).toContain('HTTPS');
    expect(service.saveAnnouncement).not.toHaveBeenCalled();
  });

  it('failed saves retain entered content for correction', async () => {
    service.saveAnnouncement.mockReturnValue(throwError(() => new Error('422')));
    const {component} = await openManager();
    component.editAnnouncement();
    component.announcementForm.patchValue({title: 'My draft', body: 'Keep my work'});
    component.save();
    expect(component.formError).toContain('Could not save');
    expect(component.announcementForm.controls.body.value).toBe('Keep my work');
    expect(component.saving).toBe(false);
  });

  it('keeps both unit selectors on the unit being shown or managed, including after a save', async () => {
    const data = feed();
    data.units = [
      {...data.units[0], can_manage: true},
      {id: 222, code: 'SIT222', name: 'Other Unit', can_manage: true},
    ];
    service.feed.mockReturnValue(of(data));
    const {component, harness, element} = await open('/unit-hub?unit=222');
    // the feed filter is a mat-select now, so check what it shows
    expect(component.selectedUnitId).toBe(222);
    expect(element.querySelector('#hub-unit')?.textContent).toContain('SIT222');
    component.toggleManage();
    harness.detectChanges();
    expect((element.querySelector('#manage-unit') as HTMLSelectElement).value).toBe('222');
    const pendingFeed: Subject<typeof data> = new Subject();
    service.feed.mockReturnValue(pendingFeed);
    component.editAnnouncement();
    component.announcementForm.patchValue({title: 'Week update', body: 'Bring questions'});
    component.save();
    harness.detectChanges();
    pendingFeed.next(data);
    harness.detectChanges();
    expect(service.saveAnnouncement).toHaveBeenCalledWith(222, expect.anything(), undefined);
    expect((element.querySelector('#manage-unit') as HTMLSelectElement).value).toBe('222');
  });

  it('opens full plain announcement details from its title and restores focus on close', async () => {
    const data = feed();
    data.announcements[0].body = 'Full announcement\n<img src=x onerror=alert(1)>\nLast paragraph';
    service.feed.mockReturnValue(of(data));
    const {harness, element} = await open();
    const title = element.querySelector('.announcement-card .details-title') as HTMLButtonElement;
    title.focus();
    title.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    const dialog = TestBed.inject(MatDialog).openDialogs[0];
    const details = dialog.componentInstance as UnitHubDetailsComponent;
    expect(details.content.announcement.body).toContain('Last paragraph');
    const overlay = document.querySelector('mat-dialog-container');
    expect(overlay.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(overlay.querySelector('img')).toBeNull();
    expect(overlay.querySelector('a a, button a, a button, button button')).toBeNull();
    expect(overlay.getAttribute('aria-labelledby')).toBe('unit-hub-detail-title');
    expect(document.activeElement?.id).toBe('unit-hub-detail-title');
    (overlay.querySelector('button[aria-label="Close details"]') as HTMLButtonElement).click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
    expect(document.activeElement).toBe(title);
  });

  it('only opens details from the current permitted feed and clears them on unit or demo changes', async () => {
    const {component, harness} = await open();
    const dialogs = TestBed.inject(MatDialog);
    component.openSession({...component.sessions[0], unit_id: 102});
    component.openAnnouncement({...component.announcements[0], unit_id: 102});
    expect(dialogs.openDialogs).toHaveLength(0);
    component.openSession(component.sessions[0]);
    const previous = dialogs.openDialogs[0].componentInstance as UnitHubDetailsComponent;
    await harness.navigateByUrl('/unit-hub?unit=102', UnitHubComponent);
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(previous.content).toBeNull();
    await vi.waitFor(() => expect(dialogs.openDialogs).toHaveLength(0));
    await harness.navigateByUrl('/unit-hub', UnitHubComponent);
    component.openAnnouncement(component.announcements[0]);
    const beforeMode = dialogs.openDialogs[0].componentInstance as UnitHubDetailsComponent;
    demo.setEnabled(true);
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(beforeMode.content).toBeNull();
    await vi.waitFor(() => expect(dialogs.openDialogs).toHaveLength(0));
  });

  it('closes details on Escape and hides cancelled meeting actions', async () => {
    const data = feed();
    data.sessions[0].cancelled = true;
    service.feed.mockReturnValue(of(data));
    const {component, harness} = await open();
    component.openSession(component.sessions[0]);
    harness.detectChanges();
    await harness.fixture.whenStable();
    const overlay = document.querySelector('mat-dialog-container');
    expect(overlay.textContent).toContain('Cancelled');
    expect(overlay.querySelector('a[href^="https://calendar.google.com"]')).toBeNull();
    expect(overlay.querySelector('f-teams-meeting-composer')).toBeNull();
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {key: 'Escape', keyCode: 27, bubbles: true}),
    );
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
  });

  it('keeps Teams meeting preparation staff-only and derives instants without saving', async () => {
    const {component, harness} = await openManager();
    component.editSession();
    expect(component.teamsDraft).toBeNull();
    component.sessionForm.patchValue({
      title: 'HelpHub',
      start_at: '2026-10-08T17:00',
      end_at: '2026-10-08T18:00',
    });
    expect(component.teamsDraft.start_at).toBe('2026-10-08T06:00:00.000Z');
    expect(service.saveSession).not.toHaveBeenCalled();
    component.openSession(component.sessions[0]);
    harness.detectChanges();
    expect(document.querySelector('mat-dialog-container f-teams-meeting-composer')).not.toBeNull();
    TestBed.inject(MatDialog).closeAll();
    await vi.waitFor(() => expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0));
    component.feed.units[0].can_manage = false;
    component.openSession(component.sessions[0]);
    harness.detectChanges();
    expect(component.teamsDraft).toBeNull();
    expect(document.querySelector('mat-dialog-container f-teams-meeting-composer')).toBeNull();
  });

  it('uses only explicitly hosted demo links in joining and calendar details', async () => {
    demo.setEnabled(true);
    const data = feed();
    const hosted = {
      ...data.sessions[0],
      demo_hosted_join: true,
      join_url: 'https://teams.microsoft.com/l/meetup-join/hosted-demo',
    };
    data.sessions = [hosted];
    service.feed.mockReturnValue(of(data));
    const {component, harness, element} = await open();
    expect(element.textContent).toContain('Join hosted demo');
    const url = new URL(component.googleUrl(component.sessions[0], 'SIT111'));
    expect(url.searchParams.get('details')).toContain(hosted.join_url);
    expect(url.searchParams.get('details')).toContain(
      'Fictional schedule; uses a real host-provided meeting link.',
    );
    component.openSession(component.sessions[0]);
    harness.detectChanges();
    const details = TestBed.inject(MatDialog).openDialogs[0]
      .componentInstance as UnitHubDetailsComponent;
    expect(details.content.joinUrl).toBe(hosted.join_url);
    expect(details.content.canManage).toBe(false);
    expect(component.joinUrl({...hosted, demo_hosted_join: false})).toBeNull();
    expect(component.joinUrl({...hosted, join_url: 'javascript:alert(1)'})).toBeNull();
    expect(component.joinUrl({...hosted, cancelled: true})).toBeNull();
  });
  describe('announcement read status', () => {
    const cards = (element: HTMLElement) =>
      Array.from(element.querySelectorAll<HTMLElement>('.announcement-card'));

    it('highlights unread announcements with a text chip and screen reader state', async () => {
      const {component, element} = await open();
      const count = component.announcements.length;
      expect(count).toBeGreaterThan(0);
      expect(component.unreadCount).toBe(count);
      const first = cards(element)[0];
      expect(first.classList).toContain('is-unread');
      expect(first.querySelector('.chip-new')?.textContent).toContain('New');
      expect(first.querySelector('h3 .visually-hidden')?.textContent).toContain('Unread');
      expect(first.querySelector('button.mark-read')?.getAttribute('aria-label')).toContain(
        'Mark as read',
      );
      expect(
        element.querySelector('.section-heading .count')?.textContent.replace(/\s+/g, ' '),
      ).toContain(`${count} · ${count} new`);
    });

    it('marks an announcement read when its details open, and persists it per user', async () => {
      const {component, harness, element} = await open();
      const title = cards(element)[0].querySelector('.details-title') as HTMLButtonElement;
      title.click();
      harness.detectChanges();
      expect(component.isUnread(component.announcements[0])).toBe(false);
      expect(cards(element)[0].classList).toContain('is-read');
      expect(cards(element)[0].querySelector('.chip-new')).toBeNull();
      expect(component.unreadCount).toBe(component.announcements.length - 1);
      const stored = JSON.parse(localStorage.getItem('ontrack.unitHub.read.7'));
      expect(Object.keys(stored)).toEqual([String(component.announcements[0].id)]);
    });

    it('marks one from its card button and all from the section heading', async () => {
      const {component, harness, element} = await open();
      (cards(element)[1].querySelector('button.mark-read') as HTMLButtonElement).click();
      harness.detectChanges();
      expect(component.isUnread(component.announcements[1])).toBe(false);
      const markAll = Array.from(element.querySelectorAll('button')).find((button) =>
        button.textContent.includes('Mark all as read'),
      );
      markAll.click();
      harness.detectChanges();
      expect(component.unreadCount).toBe(0);
      expect(element.querySelector('.chip-new')).toBeNull();
      expect(
        Array.from(element.querySelectorAll('button')).some((button) =>
          button.textContent.includes('Mark all as read'),
        ),
      ).toBe(false);
    });

    it('does not show read status while staff manage content', async () => {
      const {element} = await openManager();
      expect(element.querySelector('.chip-new')).toBeNull();
      expect(element.textContent).not.toContain('Mark all as read');
    });
  });
  it('shows card excerpts as plain text with no markdown symbols', async () => {
    const data = feed();
    data.announcements[0].body = '## Week 3\n\n**Bring** your *questions*\n\n- one\n- two';
    service.feed.mockReturnValue(of(data));
    const {element} = await open();
    const preview = element.querySelector('.announcement-card .card-preview');
    expect(preview.textContent).toBe('Week 3 Bring your questions one two');
    expect(preview.textContent).not.toMatch(/[*#]/);
    expect(preview.querySelector('strong, h3, li')).toBeNull();
  });

  it('offers a Write and Preview toggle that renders the announcement body', async () => {
    const {component, harness, element} = await openManager();
    component.editAnnouncement();
    component.announcementForm.patchValue({body: '**Bold** text'});
    harness.detectChanges();
    expect(element.textContent).toContain('Supports simple formatting');
    const preview = Array.from(element.querySelectorAll('.write-preview button')).find((button) =>
      button.textContent.includes('Preview'),
    ) as HTMLButtonElement;
    preview.click();
    harness.detectChanges();
    expect(element.querySelector('#announcement-body-preview strong')?.textContent).toBe('Bold');
    expect((element.querySelector('#announcement-body') as HTMLTextAreaElement).hidden).toBe(true);
    expect(preview.getAttribute('aria-pressed')).toBe('true');
    expect(component.announcementForm.controls.body.value).toBe('**Bold** text');
  });
  it('marks cancelled sessions with one banner, a neutral type chip and sorts them last in their day', async () => {
    const data = feed();
    const active = data.sessions[0];
    data.sessions = [
      {...active, id: 900, title: 'Cancelled one', cancelled: true},
      {...active, id: 901, title: 'Active one', cancelled: false},
    ];
    service.feed.mockReturnValue(of(data));
    const {element} = await open();
    const cards = Array.from(element.querySelectorAll('.session-card'));
    expect(cards.map((card) => card.querySelector('.details-title').textContent.trim())).toEqual([
      'Active one',
      'Cancelled one',
    ]);
    const cancelled = cards[1];
    expect(cancelled.querySelector('.cancelled-banner')?.textContent).toContain(
      'Cancelled: this session will not run',
    );
    expect(cancelled.querySelector('h4 .visually-hidden')?.textContent).toContain('Cancelled');
    expect(cancelled.querySelector('.kind-chip')?.getAttribute('data-tone')).toBe('cancelled');
    expect(cancelled.querySelector('.details-link')).not.toBeNull();
    expect(cancelled.querySelector('a[href^="https://calendar.google.com"]')).toBeNull();
    expect(cards[0].querySelector('.cancelled-banner')).toBeNull();
  });
  describe('deep links, Up next and notifications', () => {
    it('opens an announcement named in the URL, marks it read and clears the parameter', async () => {
      const id = feed().announcements[1].id;
      const {component} = await open(`/unit-hub?unit=111&announcement=${id}`);
      const dialogs = TestBed.inject(MatDialog);
      await vi.waitFor(() => expect(dialogs.openDialogs).toHaveLength(1));
      const details = dialogs.openDialogs[0].componentInstance as UnitHubDetailsComponent;
      expect(details.content.announcement.id).toBe(id);
      expect(component.isUnread(component.announcements.find((row) => row.id === id))).toBe(false);
      const url = TestBed.inject(Router).url;
      expect(url).not.toContain('announcement=');
      expect(url).toContain('unit=111');
      // clearing the parameter does not reload the feed or close the dialog
      expect(service.feed).toHaveBeenCalledTimes(1);
      expect(dialogs.openDialogs).toHaveLength(1);
    });

    it('opens a session named in the URL', async () => {
      const id = feed().sessions[0].id;
      await open(`/unit-hub?session=${id}`);
      const dialogs = TestBed.inject(MatDialog);
      await vi.waitFor(() => expect(dialogs.openDialogs).toHaveLength(1));
      const details = dialogs.openDialogs[0].componentInstance as UnitHubDetailsComponent;
      expect(details.content.session.id).toBe(id);
      expect(TestBed.inject(Router).url).not.toContain('session=');
    });

    it('explains when a linked update is no longer in the feed', async () => {
      const snack = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
      await open('/unit-hub?announcement=987654');
      await vi.waitFor(() =>
        expect(snack).toHaveBeenCalledWith(
          'That update is no longer available',
          expect.anything(),
          expect.anything(),
        ),
      );
      expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
      expect(TestBed.inject(Router).url).not.toContain('announcement=');
    });

    it('pins the next active session at the top of Upcoming and highlights starting soon', async () => {
      const data = feed();
      const base = data.sessions[0];
      const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60000).toISOString();
      data.sessions = [
        {
          ...base,
          id: 801,
          title: 'Cancelled first',
          cancelled: true,
          start_at: inMinutes(10),
          end_at: inMinutes(70),
        },
        {...base, id: 802, title: 'Soon session', start_at: inMinutes(30), end_at: inMinutes(90)},
      ];
      service.feed.mockReturnValue(of(data));
      const {component, element} = await open();
      expect(component.upNext.id).toBe(802);
      const upNext = element.querySelector('.up-next');
      expect(upNext.querySelector('.details-title')?.textContent.trim()).toBe('Soon session');
      expect(upNext.textContent).toMatch(/Starts in (29|30) min/);
      const soonCard = Array.from(element.querySelectorAll('.session-card')).find((card) =>
        card.textContent.includes('Soon session'),
      );
      expect(soonCard.getAttribute('data-timing')).toBe('soon');
      expect(soonCard.querySelector('h4 .visually-hidden')?.textContent).toContain('Starts in');
      const cancelledCard = Array.from(element.querySelectorAll('.session-card')).find((card) =>
        card.textContent.includes('Cancelled first'),
      );
      expect(cancelledCard.getAttribute('data-timing')).toBe('cancelled');
      expect(cancelledCard.querySelector('.chip-soon, .chip-now, .chip-today')).toBeNull();
    });

    it('links to the notification settings from the header', async () => {
      const {element} = await open();
      const link = element.querySelector('a[aria-label^="Get notified"]') as HTMLAnchorElement;
      expect(link.textContent).toContain('Get notified');
      expect(link.getAttribute('href')).toBe('/edit_profile#notification-settings-title');
    });
  });
});
