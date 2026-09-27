import {beforeEach, describe, expect, it, vi} from 'vitest';
import {BreakpointObserver} from '@angular/cdk/layout';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButton, MatButtonModule} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {MatIconTestingModule} from '@angular/material/icon/testing';
import {MatMenuModule} from '@angular/material/menu';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatTooltipModule} from '@angular/material/tooltip';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Router, RouterLink, provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {AuthenticationService, Unit} from 'src/app/api/models/doubtfire-model';
import {NotificationService} from 'src/app/api/services/notification.service';
import {SidekiqJobService} from 'src/app/api/services/sidekiq-job.service';
import {UserService} from 'src/app/api/services/user.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {CheckForUpdateService} from 'src/app/sessions/service-worker-updater/check-for-update.service';
import {StudentOnboardingService} from 'src/app/student-onboarding/student-onboarding.service';
import {AboutDoubtfireModal} from '../modals/about-doubtfire-modal/about-doubtfire-modal.component';
import {CalendarModalService} from '../modals/calendar-modal/calendar-modal.service';
import {QrModalService} from '../modals/qr-modal/qr-modal.service';
import {SidekiqJobsModalService} from '../modals/sidekiq-jobs-modal/sidekiq-jobs-modal.service';
import {TutorNotesModalService} from '../modals/tutor-notes-modal/tutor-notes-modal.service';
import {IsActiveUnitRole} from '../pipes/is-active-unit-role.pipe';
import {PwaInstallDialogComponent} from '../pwa/pwa-install-dialog.component';
import {expectAccessible} from '../testing/accessibility';
import {HeaderComponent} from './header.component';

const emptyProvider = {};

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HeaderComponent],
      providers: [
        {
          provide: MatDialog,
          useValue: {open: vi.fn().mockReturnValue({afterClosed: () => of(undefined)})},
        },
        {provide: StudentOnboardingService, useValue: {available: false, replay: vi.fn()}},
        {provide: CalendarModalService, useValue: emptyProvider},
        {provide: AboutDoubtfireModal, useValue: emptyProvider},
        {provide: IsActiveUnitRole, useValue: emptyProvider},
        {provide: CheckForUpdateService, useValue: emptyProvider},
        {provide: GlobalStateService, useValue: emptyProvider},
        {provide: UserService, useValue: emptyProvider},
        {provide: AuthenticationService, useValue: emptyProvider},
        {provide: BreakpointObserver, useValue: emptyProvider},
        {provide: DoubtfireConstants, useValue: emptyProvider},
        {provide: SidekiqJobService, useValue: emptyProvider},
        {provide: SidekiqJobsModalService, useValue: emptyProvider},
        {provide: QrModalService, useValue: emptyProvider},
        {provide: Router, useValue: emptyProvider},
        {provide: TutorNotesModalService, useValue: emptyProvider},
        {provide: DemoModeStore, useValue: {available: false}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(HeaderComponent, {set: {template: ''}})
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
  });

  it('opens installation help from the account menu action', () => {
    const trigger = {focus: vi.fn()} as unknown as MatButton;
    component.openInstallHelp(trigger);
    expect(trigger.focus).toHaveBeenCalledOnce();
    expect(TestBed.inject(MatDialog).open).toHaveBeenCalledWith(PwaInstallDialogComponent, {
      width: '560px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-heading',
      restoreFocus: false,
    });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('calendar entry point', () => {
    const calendarButtonSelector = 'button[aria-label="Open your calendar subscription settings"]';
    let calendarModalServiceStub: {show: ReturnType<typeof vi.fn>};
    let breakpointObserverStub: {
      isMatched: ReturnType<typeof vi.fn>;
      observe: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
      TestBed.resetTestingModule();
      calendarModalServiceStub = {show: vi.fn()};
      breakpointObserverStub = {
        isMatched: vi.fn().mockReturnValue(false),
        observe: vi.fn().mockReturnValue(of({matches: false, breakpoints: {}})),
      };

      await TestBed.configureTestingModule({
        declarations: [HeaderComponent],
        imports: [
          MatButtonModule,
          MatIconModule,
          MatIconTestingModule,
          MatMenuModule,
          MatToolbarModule,
          MatTooltipModule,
          NoopAnimationsModule,
          RouterLink,
        ],
        providers: [
          {
            provide: MatDialog,
            useValue: {open: vi.fn().mockReturnValue({afterClosed: () => of(undefined)})},
          },
          {provide: StudentOnboardingService, useValue: {available: false, replay: vi.fn()}},
          {provide: CalendarModalService, useValue: calendarModalServiceStub},
          {provide: AboutDoubtfireModal, useValue: emptyProvider},
          {provide: IsActiveUnitRole, useValue: emptyProvider},
          {provide: CheckForUpdateService, useValue: emptyProvider},
          {
            provide: GlobalStateService,
            useValue: {
              showHideHeader: of(true),
              unitRolesSubject: of(null),
              projectsSubject: of(null),
              currentViewAndEntitySubject$: of(undefined),
            },
          },
          {provide: UserService, useValue: {currentUser: {role: 'Student', username: 'student_1'}}},
          {provide: AuthenticationService, useValue: emptyProvider},
          {provide: BreakpointObserver, useValue: breakpointObserverStub},
          {
            provide: NotificationService,
            useValue: {unreadCount$: of(0), refreshUnreadCount: vi.fn(() => of(0))},
          },
          {provide: DemoModeStore, useValue: {available: false}},
          {
            provide: DoubtfireConstants,
            useValue: {
              ExternalName: of('Doubtfire'),
              LogoSettings: of({
                hasLogo: false,
                logoLinkUrl: '/assets/images/institution-logo.png',
                logoUrl: null,
              }),
            },
          },
          {provide: SidekiqJobService, useValue: {sidekiqJobsSubject: of([])}},
          {provide: SidekiqJobsModalService, useValue: emptyProvider},
          {provide: QrModalService, useValue: emptyProvider},
          provideRouter([]),
          {provide: TutorNotesModalService, useValue: emptyProvider},
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      fixture = TestBed.createComponent(HeaderComponent);
      component = fixture.componentInstance;
    });

    it('gives the rendered logo link a name and a real home destination', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const logo = fixture.nativeElement.querySelector('a[href="/home"]') as HTMLAnchorElement;
      expect(logo).not.toBeNull();
      expect(logo.getAttribute('aria-label')).toBe('Home');
      expect(logo.querySelector('mat-icon').getAttribute('aria-hidden')).toBe('true');
      const results = await expectAccessible(logo);
      expect(results.passes.some((rule) => rule.id === 'link-name')).toBe(true);

      // The SVG is decorative: losing the link's name must fail the regression.
      logo.removeAttribute('aria-label');
      await expect(expectAccessible(logo)).rejects.toThrow('link-name');
    });

    it('exposes one banner only while the responsive header is shown', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('[role="banner"]').length).toBe(1);

      breakpointObserverStub.isMatched.mockReturnValue(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('[role="banner"]').length).toBe(1);
      expect(fixture.nativeElement.querySelector('a[href="/home"]')).toBeNull();

      component.showHeader = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="banner"]')).toBeNull();
    });

    it('opens the shared tutorial from the existing account menu when eligible', async () => {
      const tutorial = TestBed.inject(StudentOnboardingService) as unknown as {
        available: boolean;
        replay: ReturnType<typeof vi.fn>;
      };
      tutorial.available = true;
      fixture.detectChanges();
      fixture.nativeElement.querySelector('[aria-label="Open account menu"]').click();
      fixture.detectChanges();
      await fixture.whenStable();
      const entries = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].filter(
        (entry) => entry.textContent.includes('Tutorial and Help'),
      );
      expect(entries.length).toBe(1);
      entries[0].click();
      expect(tutorial.replay).toHaveBeenCalledOnce();
    });

    it('keeps the calendar out of the toolbar at every width', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(calendarButtonSelector)).toBeNull();

      breakpointObserverStub.isMatched.mockReturnValue(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(calendarButtonSelector)).toBeNull();
    });

    // The phone toolbar has no room for the theme toggle, which moves to the account
    // menu there, but the notification bell stays so a student sees new feedback.
    it('keeps the notification bell on a phone toolbar and the theme toggle off it', () => {
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-theme-toggle')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('notification-bell')).not.toBeNull();

      breakpointObserverStub.isMatched.mockReturnValue(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-theme-toggle')).toBeNull();
      expect(fixture.nativeElement.querySelector('notification-bell')).not.toBeNull();

      breakpointObserverStub.isMatched.mockReturnValue(false);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-theme-toggle')).not.toBeNull();
    });

    it('opens the calendar from the account menu', async () => {
      const openCalendarSpy = vi.spyOn(component, 'openCalendar');
      fixture.detectChanges();
      await fixture.whenStable();

      const accountMenuTrigger: HTMLButtonElement =
        fixture.nativeElement.querySelector('.account-menu-trigger');
      accountMenuTrigger.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const calendarItem = Array.from(
        document.querySelectorAll<HTMLButtonElement>('button[mat-menu-item]'),
      ).find((item) => item.textContent.includes('Calendar'));
      expect(calendarItem).toBeTruthy();

      calendarItem.click();

      expect(openCalendarSpy).toHaveBeenCalledOnce();
      expect(calendarModalServiceStub.show).toHaveBeenCalledOnce();
    });

    it('keeps QR access in the account menu and removes it from the toolbar', async () => {
      breakpointObserverStub.isMatched.mockReturnValue(true);
      fixture.detectChanges();
      await fixture.whenStable();
      component.currentUnit = {id: 1} as Unit;
      const showMyQrSpy = vi.spyOn(component, 'showMyQr').mockImplementation(() => undefined);
      fixture.detectChanges();

      const toolbarAction: HTMLButtonElement =
        fixture.nativeElement.querySelector('.qr-toolbar-action');
      const accountMenuTrigger: HTMLButtonElement =
        fixture.nativeElement.querySelector('.account-menu-trigger');

      expect(toolbarAction).toBeNull();
      expect(accountMenuTrigger).not.toBeNull();

      accountMenuTrigger.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const menuAction: HTMLButtonElement = document.querySelector('.qr-account-menu-action');
      expect(menuAction).not.toBeNull();

      menuAction.click();
      expect(showMyQrSpy).toHaveBeenCalledOnce();
    });

    it('renders the notification bell directly in the phone toolbar', () => {
      breakpointObserverStub.isMatched.mockReturnValue(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('notification-bell')).not.toBeNull();
    });
  });

  describe('uniqueUnitRoles', () => {
    // Treat every role as active so the test targets the dedup logic only.
    beforeEach(() => {
      component['isActiveUnitRole'] = {transform: (roles: unknown[]) => roles} as never;
    });

    const roleFor = (unitId: number, role = 'Student') => ({unit: {id: unitId}, role}) as never;

    it('keeps a role when its unit appears once', () => {
      const roles = [roleFor(1), roleFor(2)];

      const result = component.uniqueUnitRoles(roles);

      expect(result).toHaveLength(2);
    });

    it('drops both non-tutor roles when a unit appears more than once', () => {
      const roles = [roleFor(1), roleFor(1), roleFor(2)];

      const result = component.uniqueUnitRoles(roles).map((r: {unit: {id: number}}) => r.unit.id);

      expect(result).toEqual([2]);
    });

    it('always keeps a tutor role even when the unit is duplicated', () => {
      const roles = [roleFor(1, 'Tutor'), roleFor(1)];

      const result = component.uniqueUnitRoles(roles);

      expect(result).toHaveLength(1);
      expect((result[0] as {role: string}).role).toBe('Tutor');
    });
  });
});
