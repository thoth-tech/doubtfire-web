import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatMenuModule} from '@angular/material/menu';
import {MatSelectModule} from '@angular/material/select';
import {MatSnackBar} from '@angular/material/snack-bar';
import {ActivatedRoute, NavigationStart, ParamMap, Router, RouterLink} from '@angular/router';
import {Subscription, combineLatest, forkJoin} from 'rxjs';
import {CalendarModalService} from 'src/app/common/modals/calendar-modal/calendar-modal.service';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {StudyEssentialsComponent} from '../study-essentials/study-essentials.component';
import {AnnouncementReadStore} from './announcement-read.store';
import {HubMarkdownPipe, HubPlainTextPipe} from './hub-markdown';
import {SessionTiming, sessionTiming, upNextSession} from './session-timing';
import {buildStatusGuide} from './status-guide';
import {TeamsMeetingComposerComponent} from './teams-meeting-composer.component';
import {TeamsMeetingDraft} from './teams-meeting-draft';
import {
  dateTimeInZone,
  dateTimeToIso,
  googleSessionUrl,
  safeHttpsUrl,
  sessionIcs,
} from './unit-hub-calendar';
import {UnitHubDetailsComponent, UnitHubDetailsData} from './unit-hub-details.component';
import {
  HubUnit,
  LearningSession,
  SESSION_KINDS,
  SessionKind,
  UnitAnnouncement,
  UnitHubFeed,
} from './unit-hub.models';
import {UnitHubService} from './unit-hub.service';

@Component({
  selector: 'f-unit-hub',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    MatFormFieldModule,
    MatSelectModule,
    RouterLink,
    StudyEssentialsComponent,
    TeamsMeetingComposerComponent,
    HubMarkdownPipe,
    HubPlainTextPipe,
  ],
  templateUrl: './unit-hub.component.html',
  styleUrl: './unit-hub.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class UnitHubComponent implements OnInit, OnDestroy {
  readonly sessionKinds = SESSION_KINDS;
  readonly deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  readonly safeUrl = safeHttpsUrl;
  feed: UnitHubFeed = {units: [], announcements: [], sessions: []};
  loading = true;
  loadError = '';
  selectedUnitId = 0;
  unavailableUnit = false;
  tab: 'all' | 'announcements' | 'sessions' = 'all';
  // long feeds show a first page so the rest of the hub stays in reach
  readonly announcementPage = 6;
  readonly sessionDayPage = 4;
  showAllAnnouncements = false;
  showAllSessionDays = false;
  managing = false;
  managedUnitId = 0;
  staffLoading = false;
  staffError = '';
  staffAnnouncements: UnitAnnouncement[] = [];
  staffSessions: LearningSession[] = [];
  editor: 'announcement' | 'session' | null = null;
  editingId?: number;
  editingPublishedAt: string | null = null;
  // Write / Preview for the markdown fields in the staff editor
  announcementPreview = false;
  sessionPreview = false;
  saving = false;
  formError = '';
  status = '';
  deleteCandidate: {id: number; title: string; kind: 'announcements' | 'sessions'} | null = null;
  private subscriptions = new Subscription();
  private feedRequest?: Subscription;
  private staffRequest?: Subscription;
  private mutationRequest?: Subscription;
  private detailsRef?: MatDialogRef<UnitHubDetailsComponent>;
  /** Refreshed every minute, so the time highlights and countdowns stay current. */
  now = Date.now();
  private clock?: ReturnType<typeof setInterval>;
  private readonly zone = inject(NgZone);
  private readonly changes = inject(ChangeDetectorRef);
  private readonly snackBar = inject(MatSnackBar);
  /** An announcement or session named in the URL, opened once the feed has loaded. */
  private pendingLink: {announcement: number; session: number} | null = null;
  private feedKey: string | null = null;

  readonly announcementForm;
  readonly sessionForm;

  constructor(
    private service: UnitHubService,
    readonly demo: DemoModeStore,
    private calendars: CalendarModalService,
    private route: ActivatedRoute,
    private router: Router,
    formBuilder: FormBuilder,
    private dialogs: MatDialog,
    private readStatus: AnnouncementReadStore,
  ) {
    this.announcementForm = formBuilder.nonNullable.group({
      title: ['', [Validators.required, Validators.maxLength(200)]],
      body: ['', [Validators.required, Validators.maxLength(20000)]],
      source_url: [''],
      pinned: [false],
      published: [false],
      expires_at: [''],
    });
    this.sessionForm = formBuilder.nonNullable.group({
      title: ['', [Validators.required, Validators.maxLength(200)]],
      description: ['', Validators.maxLength(20000)],
      kind: ['helphub' as SessionKind],
      start_at: ['', Validators.required],
      end_at: ['', Validators.required],
      timezone: ['Australia/Melbourne', Validators.required],
      join_url: [''],
      location: ['', Validators.maxLength(300)],
      source_url: [''],
      published: [false],
      cancelled: [false],
      recurrence: ['none' as 'none' | 'weekly'],
      recurrence_until: [''],
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.router.events.subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.closeDetails();
        }
      }),
    );
    this.subscriptions.add(
      combineLatest([this.demo.enabled$, this.route.queryParamMap]).subscribe(
        ([enabled, params]) => {
          const announcement = Number(params.get('announcement')) || 0;
          const session = Number(params.get('session')) || 0;
          if (announcement || session) {
            this.pendingLink = {announcement, session};
          }
          // Clearing a deep link from the URL must not reload the feed or close its dialog.
          const key = this.feedParamsKey(enabled, params);
          if (key === this.feedKey && !this.loading && !this.loadError) {
            this.openPendingLink();
            return;
          }
          this.feedKey = key;
          this.mutationRequest?.unsubscribe();
          this.saving = false;
          this.managing = false;
          this.selectedUnitId = Number(params.get('unit')) || 0;
          this.reload();
        },
      ),
    );
    // outside Angular, so a pending timer never holds the zone open; it re-enters to update
    this.zone.runOutsideAngular(() => {
      this.clock = setInterval(() => this.zone.run(() => (this.now = Date.now())), 60_000);
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.clock);
    this.closeDetails();
    this.subscriptions.unsubscribe();
    this.feedRequest?.unsubscribe();
    this.staffRequest?.unsubscribe();
    this.mutationRequest?.unsubscribe();
  }

  get units(): HubUnit[] {
    return this.feed.units;
  }
  get manageableUnits(): HubUnit[] {
    return this.demo.enabled ? [] : this.units.filter((unit) => unit.can_manage);
  }
  get visibleAnnouncements(): UnitAnnouncement[] {
    const rows = this.announcements;
    return this.showAllAnnouncements ? rows : rows.slice(0, this.announcementPage);
  }
  get visibleSessionGroups() {
    const groups = this.sessionGroups;
    return this.showAllSessionDays ? groups : groups.slice(0, this.sessionDayPage);
  }
  get announcements(): UnitAnnouncement[] {
    return this.feed.announcements.filter(
      (row) => !this.selectedUnitId || row.unit_id === this.selectedUnitId,
    );
  }
  get sessions(): LearningSession[] {
    return this.feed.sessions.filter(
      (row) => !this.selectedUnitId || row.unit_id === this.selectedUnitId,
    );
  }
  get canManageSelected(): boolean {
    return this.manageableUnits.some((unit) => unit.id === this.managedUnitId);
  }
  get managedTeamsConfigured(): boolean {
    return this.units.find((unit) => unit.id === this.managedUnitId)?.teams_sync === 'configured';
  }
  /** Read status is a student feed concern; staff managing content do not see it. */
  isUnread(row: UnitAnnouncement): boolean {
    return this.readStatus.isUnread(row);
  }
  get unreadCount(): number {
    return this.announcements.filter((row) => this.readStatus.isUnread(row)).length;
  }
  markRead(row: UnitAnnouncement): void {
    if (this.announcements.includes(row)) {
      this.readStatus.markRead([row]);
      // the read state lives outside Angular's inputs, so ask for a redraw now rather
      // than on the next unrelated change
      this.changes.markForCheck();
    }
  }
  markAllRead(): void {
    this.readStatus.markRead(this.announcements.filter((row) => this.readStatus.isUnread(row)));
    this.changes.markForCheck();
  }
  isManagedExternally(row: UnitAnnouncement): boolean {
    return row.managed_externally === true || row.source_provider === 'microsoft_teams';
  }
  unitCode(id: number): string {
    return this.units.find((unit) => unit.id === id)?.code ?? '';
  }
  kindLabel(kind: string): string {
    return this.sessionKinds.find((item) => item.value === kind)?.label ?? 'Class or event';
  }
  kindIcon(kind: string): string {
    return this.sessionKinds.find((item) => item.value === kind)?.icon ?? 'event';
  }
  kindTone(kind: string): string {
    return kind === 'helphub' || kind === 'lecture' ? kind : 'class';
  }
  get showFeed(): boolean {
    return !this.loading && !this.loadError && !this.managing && this.units.length > 0;
  }

  /** What each task status means, read from the same source the task pages use. */
  public readonly statusGuide = buildStatusGuide();
  public statusGuideOpen = false;

  public toggleStatusGuide(): void {
    this.statusGuideOpen = !this.statusGuideOpen;
  }
  /** Upcoming sessions grouped by the local calendar day they start on. */
  get sessionGroups(): {key: string; label: string; date: string; sessions: LearningSession[]}[] {
    const dayKey = (value: Date) =>
      `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`;
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const groups: {key: string; label: string; date: string; sessions: LearningSession[]}[] = [];
    for (const session of this.sessions) {
      const key = dayKey(new Date(session.start_at));
      let group = groups.find((item) => item.key === key);
      if (!group) {
        const label = key === dayKey(today) ? 'Today' : key === dayKey(tomorrow) ? 'Tomorrow' : '';
        group = {key, label, date: session.start_at, sessions: []};
        groups.push(group);
      }
      group.sessions.push(session);
    }
    // cancelled sessions follow the active ones on the same day; the sort is stable
    for (const group of groups) {
      group.sessions.sort((a, b) => Number(a.cancelled) - Number(b.cancelled));
    }
    return groups;
  }
  startAnnouncement(): void {
    this.openEditor('announcement');
  }
  startSession(): void {
    this.openEditor('session');
  }
  private openEditor(kind: 'announcement' | 'session'): void {
    if (!this.managing) {
      this.toggleManage();
    }
    if (kind === 'announcement') {
      this.editAnnouncement();
    } else {
      this.editSession();
    }
  }
  timing(session: LearningSession): SessionTiming {
    return sessionTiming(session, this.now);
  }
  get upNext(): LearningSession | null {
    return upNextSession(this.sessions, this.now);
  }

  reload(): void {
    this.closeDetails();
    this.feedRequest?.unsubscribe();
    this.staffRequest?.unsubscribe();
    this.feed = {units: [], announcements: [], sessions: []};
    this.staffAnnouncements = [];
    this.staffSessions = [];
    this.editor = null;
    this.deleteCandidate = null;
    this.loadError = '';
    this.loading = true;
    this.feedRequest = this.service.feed().subscribe({
      next: (feed) => {
        this.feed = feed;
        this.readStatus.sync(feed.announcements, !this.demo.enabled);
        this.unavailableUnit =
          !!this.selectedUnitId && !feed.units.some((unit) => unit.id === this.selectedUnitId);
        this.loading = false;
        if (this.managing) {
          this.loadStaff(this.managedUnitId);
        }
        this.openPendingLink();
      },
      error: () => {
        this.pendingLink = null;
        this.loadError =
          'We could not load your unit updates. Please try again. If this continues, contact your teaching team.';
        this.loading = false;
      },
    });
  }

  selectUnit(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {unit: Number(value) || null},
      queryParamsHandling: 'merge',
    });
  }

  private feedParamsKey(enabled: boolean, params: ParamMap): string {
    const kept = params.keys
      .filter((name) => name !== 'announcement' && name !== 'session')
      .sort()
      .map((name) => [name, params.getAll(name)]);
    return JSON.stringify([enabled, kept]);
  }

  /**
   * Opens the announcement or session named by ?announcement= or ?session= once, then removes
   * those parameters with replaceUrl so a refresh does not open it again.
   */
  private openPendingLink(): void {
    const link = this.pendingLink;
    if (!link || this.loading || this.loadError) {
      return;
    }
    this.pendingLink = null;
    // after the current navigation settles; the URL change runs first because a router
    // navigation closes any open details
    setTimeout(() => {
      void this.router
        .navigate([], {
          relativeTo: this.route,
          queryParams: {announcement: null, session: null},
          queryParamsHandling: 'merge',
          replaceUrl: true,
        })
        .finally(() => {
          const announcement = link.announcement
            ? this.announcements.find((row) => row.id === link.announcement)
            : undefined;
          const session =
            !announcement && link.session
              ? // a weekly session repeats with the same id, so open its next occurrence
                (this.sessions.find(
                  (row) =>
                    row.id === link.session &&
                    !row.cancelled &&
                    Date.parse(row.end_at) >= Date.now(),
                ) ??
                this.sessions.find((row) => row.id === link.session && !row.cancelled) ??
                this.sessions.find((row) => row.id === link.session))
              : undefined;
          if (announcement) {
            this.openAnnouncement(announcement);
          } else if (session) {
            this.openSession(session);
          } else {
            this.snackBar.open('That update is no longer available', 'Dismiss', {duration: 6000});
          }
        });
    });
  }

  openCalendar(): void {
    if (!this.demo.enabled) {
      this.calendars.show();
    }
  }

  joinUrl(session: LearningSession): string | null {
    if (session.cancelled || (this.demo.enabled && !session.demo_hosted_join)) {
      return null;
    }
    return safeHttpsUrl(session.join_url);
  }

  openAnnouncement(announcement: UnitAnnouncement): void {
    const unit = this.units.find((item) => item.id === announcement.unit_id);
    if (!unit || !this.announcements.includes(announcement)) {
      return;
    }
    this.readStatus.markRead([announcement]);
    this.changes.markForCheck();
    this.showDetails({
      unitCode: unit.code,
      unitName: unit.name,
      demo: this.demo.enabled,
      canManage: !this.demo.enabled && unit.can_manage,
      announcement: Object.freeze({...announcement}),
    });
  }

  openSession(session: LearningSession): void {
    const unit = this.units.find((item) => item.id === session.unit_id);
    if (!unit || !this.sessions.includes(session)) {
      return;
    }
    this.showDetails({
      unitCode: unit.code,
      unitName: unit.name,
      demo: this.demo.enabled,
      canManage: !this.demo.enabled && unit.can_manage,
      session: Object.freeze({...session}),
      joinUrl: this.joinUrl(session),
      googleCalendarUrl: session.cancelled ? null : this.googleUrl(session, unit.code),
      download: () => this.downloadSession(session),
      calendarSettings: () => this.openCalendar(),
    });
  }

  private showDetails(data: UnitHubDetailsData): void {
    this.closeDetails();
    const ref = this.dialogs.open(UnitHubDetailsComponent, {
      data,
      width: '760px',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: '90dvh',
      ariaLabelledBy: 'unit-hub-detail-title',
      autoFocus: '#unit-hub-detail-title',
      restoreFocus: true,
      disableClose: false,
      closeOnNavigation: true,
      exitAnimationDuration: 0,
    });
    this.detailsRef = ref;
    this.subscriptions.add(
      ref.afterClosed().subscribe(() => {
        ref.componentInstance?.clear();
        if (this.detailsRef === ref) {
          this.detailsRef = undefined;
        }
      }),
    );
  }

  private closeDetails(): void {
    this.detailsRef?.componentInstance?.clear();
    this.detailsRef?.close();
    this.detailsRef = undefined;
  }

  get teamsDraft(): TeamsMeetingDraft | null {
    if (!this.canManageSelected || this.editor !== 'session') {
      return null;
    }
    const values = this.sessionForm.getRawValue();
    if (!values.title.trim() || !values.start_at || !values.end_at || !values.timezone) {
      return null;
    }
    try {
      const start_at = dateTimeToIso(values.start_at, values.timezone);
      const end_at = dateTimeToIso(values.end_at, values.timezone);
      if (Date.parse(end_at) <= Date.parse(start_at)) {
        return null;
      }
      return {
        title: values.title.trim(),
        description: values.description,
        start_at,
        end_at,
        timezone: values.timezone,
        location: values.location,
        recurrence: values.recurrence,
        recurrence_until: values.recurrence_until || undefined,
        cancelled: values.cancelled,
      };
    } catch {
      return null;
    }
  }

  downloadSession(session: LearningSession): void {
    if (session.cancelled || !this.sessions.includes(session)) {
      return;
    }
    const content = sessionIcs(
      this.calendarSession(session),
      this.unitCode(session.unit_id),
      new Date(),
      this.demo.enabled ? 'demo' : 'live',
    );
    const url = URL.createObjectURL(new Blob([content], {type: 'text/calendar;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ontrack-${this.demo.enabled ? 'demo-' : ''}session-${session.id}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.status = this.demo.enabled
      ? 'Fictional DEMO calendar copy downloaded. This is not a real session.'
      : 'Calendar copy downloaded. Subscribe to keep future changes up to date.';
  }

  googleUrl(session: LearningSession, unitCode: string): string {
    return googleSessionUrl(this.calendarSession(session), unitCode);
  }

  private calendarSession(session: LearningSession): LearningSession {
    return this.demo.enabled
      ? {
          ...session,
          title: `DEMO · ${session.title}`,
          description: `FICTIONAL ONTRACK DEMO. Fictional schedule and sample content.${session.demo_hosted_join ? ' Fictional schedule; uses a real host-provided meeting link.' : ''}\n\n${session.description}`,
          join_url: session.demo_hosted_join ? safeHttpsUrl(session.join_url) : null,
          source_url: null,
          location: 'Fictional demo only',
        }
      : session;
  }

  toggleManage(): void {
    if (!this.manageableUnits.length) {
      return;
    }
    this.managing = !this.managing;
    this.editor = null;
    this.deleteCandidate = null;
    if (this.managing) {
      const unit =
        this.manageableUnits.find((item) => item.id === this.selectedUnitId) ??
        this.manageableUnits[0];
      this.loadStaff(unit.id);
    }
  }

  loadStaff(id: number): void {
    this.closeDetails();
    this.staffRequest?.unsubscribe();
    this.editor = null;
    this.deleteCandidate = null;
    this.managedUnitId = Number(id);
    this.staffAnnouncements = [];
    this.staffSessions = [];
    this.staffError = '';
    this.staffLoading = false;
    if (!this.canManageSelected) {
      return;
    }
    this.staffLoading = true;
    this.staffRequest = forkJoin({
      announcements: this.service.announcements(this.managedUnitId),
      sessions: this.service.sessions(this.managedUnitId),
    }).subscribe({
      next: (result) => {
        this.staffAnnouncements = result.announcements.filter(
          (row) => row.unit_id === this.managedUnitId,
        );
        this.staffSessions = result.sessions.filter((row) => row.unit_id === this.managedUnitId);
        this.staffLoading = false;
      },
      error: () => {
        this.staffLoading = false;
        this.staffError =
          'We could not load the content you manage. Check your unit access or try again.';
      },
    });
  }

  editAnnouncement(row?: UnitAnnouncement): void {
    if (!this.canManageSelected || this.saving || (row && this.isManagedExternally(row))) {
      return;
    }
    this.editor = 'announcement';
    this.announcementPreview = false;
    this.editingId = row?.id;
    this.editingPublishedAt = row?.published_at ?? null;
    this.formError = '';
    this.announcementForm.reset({
      title: row?.title ?? '',
      body: row?.body ?? '',
      source_url: row?.source_url ?? '',
      pinned: row?.pinned ?? false,
      published: !!row?.published_at,
      expires_at: row?.expires_at ? dateTimeInZone(row.expires_at, this.deviceTimeZone) : '',
    });
  }

  editSession(row?: LearningSession): void {
    if (!this.canManageSelected || this.saving) {
      return;
    }
    this.editor = 'session';
    this.sessionPreview = false;
    this.editingId = row?.id;
    this.formError = '';
    const timezone = row?.timezone ?? 'Australia/Melbourne';
    this.sessionForm.reset({
      title: row?.title ?? '',
      description: row?.description ?? '',
      kind: row?.kind ?? 'helphub',
      start_at: row ? dateTimeInZone(row.start_at, timezone) : '',
      end_at: row ? dateTimeInZone(row.end_at, timezone) : '',
      timezone,
      join_url: row?.join_url ?? '',
      source_url: row?.source_url ?? '',
      location: row?.location ?? '',
      published: row?.published ?? false,
      cancelled: row?.cancelled ?? false,
      recurrence: row?.recurrence ?? 'none',
      recurrence_until: row?.recurrence_until ?? '',
    });
  }

  save(): void {
    if (!this.canManageSelected || this.saving || !this.editor) {
      return;
    }
    this.formError = '';
    try {
      let request;
      if (this.editor === 'announcement') {
        if (this.announcementForm.invalid) {
          throw new Error('Enter a title and announcement, within the field limits.');
        }
        const values = this.announcementForm.getRawValue();
        request = this.service.saveAnnouncement(
          this.managedUnitId,
          {
            title: values.title.trim(),
            body: values.body.trim(),
            pinned: values.pinned,
            source_url: this.checkedUrl(values.source_url),
            published_at: values.published
              ? (this.editingPublishedAt ?? new Date().toISOString())
              : null,
            expires_at: values.expires_at
              ? dateTimeToIso(values.expires_at, this.deviceTimeZone)
              : null,
          },
          this.editingId,
        );
      } else {
        if (this.sessionForm.invalid) {
          throw new Error('Enter a title, start time, end time and time zone.');
        }
        const values = this.sessionForm.getRawValue();
        const start_at = dateTimeToIso(values.start_at, values.timezone);
        const end_at = dateTimeToIso(values.end_at, values.timezone);
        if (Date.parse(end_at) <= Date.parse(start_at)) {
          throw new Error('End time must be after start time.');
        }
        if (values.recurrence === 'weekly' && !values.recurrence_until) {
          throw new Error('Choose the last date for the weekly sessions.');
        }
        request = this.service.saveSession(
          this.managedUnitId,
          {
            ...values,
            title: values.title.trim(),
            start_at,
            end_at,
            join_url: this.checkedUrl(values.join_url),
            source_url: this.checkedUrl(values.source_url),
            recurrence_until: values.recurrence === 'weekly' ? values.recurrence_until : null,
          },
          this.editingId,
        );
      }
      this.saving = true;
      this.mutationRequest = request.subscribe({
        next: () => {
          this.saving = false;
          this.status = 'Your changes have been saved.';
          this.reload();
        },
        error: () => {
          this.saving = false;
          this.formError =
            'Could not save. Check the dates, field lengths, HTTPS links and your unit access, then try again.';
        },
      });
    } catch (error) {
      this.formError =
        error instanceof RangeError
          ? 'Enter a valid time zone, such as Australia/Melbourne.'
          : (error as Error).message;
    }
  }

  confirmRemove(): void {
    if (!this.canManageSelected || !this.deleteCandidate || this.saving) {
      return;
    }
    const candidate = this.deleteCandidate;
    if (candidate.kind === 'announcements') {
      const row = this.staffAnnouncements.find((item) => item.id === candidate.id);
      if (row && this.isManagedExternally(row)) {
        return;
      }
    }
    this.saving = true;
    this.mutationRequest = this.service
      .remove(this.managedUnitId, candidate.kind, candidate.id)
      .subscribe({
        next: () => {
          this.saving = false;
          this.status =
            candidate.kind === 'sessions'
              ? 'Session cancelled. Calendar subscribers will receive the change when their calendar refreshes.'
              : 'Announcement removed.';
          this.reload();
        },
        error: () => {
          this.saving = false;
          this.staffError = 'Could not apply this change. Please try again.';
        },
      });
  }

  private checkedUrl(value: string): string | null {
    if (!value.trim()) {
      return null;
    }
    const safe = safeHttpsUrl(value.trim());
    if (!safe) {
      throw new Error('Use a complete HTTPS link without a username, password or spaces.');
    }
    return safe;
  }
}
