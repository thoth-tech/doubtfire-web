import {MediaObserver} from 'ng-flex-layout';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatMenuModule} from '@angular/material/menu';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatTooltipModule} from '@angular/material/tooltip';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Router} from '@angular/router';
import {Observable, defer, of} from 'rxjs';
import {AuthenticationService, Unit} from 'src/app/api/models/doubtfire-model';
import {NotificationService} from 'src/app/api/services/notification.service';
import {SidekiqJobService} from 'src/app/api/services/sidekiq-job.service';
import {UserService} from 'src/app/api/services/user.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {CheckForUpdateService} from 'src/app/sessions/service-worker-updater/check-for-update.service';
import {AboutDoubtfireModal} from '../modals/about-doubtfire-modal/about-doubtfire-modal.component';
import {CalendarModalService} from '../modals/calendar-modal/calendar-modal.service';
import {QrModalService} from '../modals/qr-modal/qr-modal.service';
import {SidekiqJobsModalService} from '../modals/sidekiq-jobs-modal/sidekiq-jobs-modal.service';
import {TutorNotesModalService} from '../modals/tutor-notes-modal/tutor-notes-modal.service';
import {IsActiveUnitRole} from '../pipes/is-active-unit-role.pipe';
import {HeaderComponent} from './header.component';

const emptyProvider = {};

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  let refreshSubscribed: boolean;

  let authenticationService: {
    isAuthenticated: ReturnType<typeof vi.fn>;
  };

  let mediaObserver: {
    isActive: ReturnType<typeof vi.fn>;
  };

  let notificationService: {
    unreadCount$: Observable<number>;
    refreshUnreadCount: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    refreshSubscribed = false;

    authenticationService = {
      isAuthenticated: vi.fn().mockReturnValue(true),
    };

    mediaObserver = {
      isActive: vi.fn().mockImplementation((alias: string) => alias === 'xs'),
    };

    notificationService = {
      unreadCount$: of(0),
      refreshUnreadCount: vi.fn(() =>
        defer(() => {
          refreshSubscribed = true;
          return of(0);
        }),
      ),
    };

    await TestBed.configureTestingModule({
      declarations: [HeaderComponent],
      providers: [
        {provide: CalendarModalService, useValue: emptyProvider},
        {provide: AboutDoubtfireModal, useValue: emptyProvider},
        {provide: IsActiveUnitRole, useValue: emptyProvider},
        {provide: CheckForUpdateService, useValue: emptyProvider},
        {provide: GlobalStateService, useValue: emptyProvider},
        {provide: UserService, useValue: emptyProvider},
        {provide: AuthenticationService, useValue: authenticationService},
        {provide: MediaObserver, useValue: mediaObserver},
        {provide: DoubtfireConstants, useValue: emptyProvider},
        {provide: NotificationService, useValue: notificationService},
        {provide: SidekiqJobService, useValue: emptyProvider},
        {provide: SidekiqJobsModalService, useValue: emptyProvider},
        {provide: QrModalService, useValue: emptyProvider},
        {provide: Router, useValue: emptyProvider},
        {provide: TutorNotesModalService, useValue: emptyProvider},
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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('refreshes the unread count when the mobile account menu opens', () => {
    component.refreshMobileUnreadCount();

    expect(notificationService.refreshUnreadCount).toHaveBeenCalledTimes(1);
    expect(refreshSubscribed).toBe(true);
  });

  it('does not refresh the mobile count on larger screens', () => {
    mediaObserver.isActive.mockReturnValue(false);

    component.refreshMobileUnreadCount();

    expect(notificationService.refreshUnreadCount).not.toHaveBeenCalled();
  });

  it('does not refresh the mobile count after sign out', () => {
    authenticationService.isAuthenticated.mockReturnValue(false);

    component.refreshMobileUnreadCount();

    expect(notificationService.refreshUnreadCount).not.toHaveBeenCalled();
  });

  describe('calendar entry point', () => {
    const calendarButtonSelector = 'button[aria-label="Open your calendar subscription settings"]';
    let calendarModalServiceStub: {show: ReturnType<typeof vi.fn>};
    let mediaObserverStub: {isActive: ReturnType<typeof vi.fn>};

    beforeEach(async () => {
      TestBed.resetTestingModule();
      calendarModalServiceStub = {show: vi.fn()};
      mediaObserverStub = {isActive: vi.fn().mockReturnValue(false)};

      await TestBed.configureTestingModule({
        declarations: [HeaderComponent],
        imports: [
          MatButtonModule,
          MatIconModule,
          MatMenuModule,
          MatToolbarModule,
          MatTooltipModule,
          NoopAnimationsModule,
        ],
        providers: [
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
          {provide: MediaObserver, useValue: mediaObserverStub},
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
          {provide: Router, useValue: {url: '/projects/1/dashboard'}},
          {provide: TutorNotesModalService, useValue: emptyProvider},
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      fixture = TestBed.createComponent(HeaderComponent);
      component = fixture.componentInstance;
    });

    it('renders the calendar button in the header', () => {
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector(calendarButtonSelector);

      expect(button).not.toBeNull();
    });

    it('keeps the compact mobile toolbar clear and leaves calendar access in the account menu', () => {
      mediaObserverStub.isActive.mockImplementation((alias: string) => alias === 'xs');
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector(calendarButtonSelector);

      expect(button).toBeNull();
    });

    it('clicking the calendar button invokes the same handler the avatar menu Calendar item uses', () => {
      const openCalendarSpy = vi.spyOn(component, 'openCalendar');
      fixture.detectChanges();

      const button: HTMLButtonElement = fixture.nativeElement.querySelector(calendarButtonSelector);
      button.click();

      expect(openCalendarSpy).toHaveBeenCalledOnce();
      expect(calendarModalServiceStub.show).toHaveBeenCalledOnce();
    });

    it('keeps the QR action in the account menu when the narrow toolbar action is hidden', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      component.currentUnit = {id: 1} as Unit;
      const showMyQrSpy = vi.spyOn(component, 'showMyQr').mockImplementation(() => undefined);
      fixture.detectChanges();

      const toolbarAction: HTMLButtonElement =
        fixture.nativeElement.querySelector('.qr-toolbar-action');
      const accountMenuTrigger: HTMLButtonElement =
        fixture.nativeElement.querySelector('.account-menu-trigger');

      expect(toolbarAction).not.toBeNull();
      expect(accountMenuTrigger).not.toBeNull();

      accountMenuTrigger.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const menuAction: HTMLButtonElement = document.querySelector('.qr-account-menu-action');
      expect(menuAction).not.toBeNull();

      menuAction.click();
      expect(showMyQrSpy).toHaveBeenCalledOnce();
    });
  });
});
