import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {OverlayContainer} from '@angular/cdk/overlay';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatBadge, MatBadgeModule} from '@angular/material/badge';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatMenuModule} from '@angular/material/menu';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatTooltipModule} from '@angular/material/tooltip';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {NavigationEnd, Router} from '@angular/router';
import {BehaviorSubject, Observable, Subject, config, defer, of, throwError} from 'rxjs';
import {Notification} from 'src/app/api/models/notification';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {NotificationRouteService} from 'src/app/api/services/notification-route.service';
import {NotificationService} from 'src/app/api/services/notification.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {ConfirmationModalService} from '../../modals/confirmation-modal/confirmation-modal.service';
import {NotificationBellComponent} from './notification-bell.component';

/**
 * The bell has three jobs and each one is a way for it to be wrong: show the
 * number the service holds, show nothing at all when that number is zero, and
 * ask again as the user moves around the app. The two after those cover the
 * ones that are easy to leave out, a count request going out after sign out and
 * one still going out after the component is gone.
 *
 * The dropdown tests open the real menu and read the real overlay rather than
 * poking at the component's fields, because "handle the empty state" is a
 * question about what is on the screen. The one that matters most is the pair
 * about failure: a list that came back empty and a list that failed to come
 * back look identical from the outside and mean opposite things.
 */
describe('NotificationBellComponent', () => {
  let component: NotificationBellComponent;
  let fixture: ComponentFixture<NotificationBellComponent>;
  let overlayContainer: OverlayContainer;

  let unreadCount: BehaviorSubject<number>;
  let routerEvents: Subject<NavigationEnd>;
  let list: Subject<Notification[]>;
  let subscribedTo: Set<string>;
  let notificationService: {
    unreadCount$: BehaviorSubject<number>;
    refreshUnreadCount: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
    markAllRead: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let completeAuthentication: (authenticated: boolean) => void;

  let authenticationService: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    afterAuthCall: ReturnType<typeof vi.fn>;
  };
  let confirmationModal: {show: ReturnType<typeof vi.fn>};
  let alerts: {success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>};
  let router: {events: unknown; navigateByUrl: ReturnType<typeof vi.fn>};
  let notificationRoutes: {navigate: ReturnType<typeof vi.fn>};

  /**
   * A stand-in that records whether anybody actually subscribed.
   *
   * A spy that only counts calls is happy either way, and every one of these
   * methods returns a cold observable, so dropping the .subscribe() in the
   * component sends no request at all while every call count stays the same.
   */
  const answers = <T>(name: string, value: T): Observable<T> =>
    defer(() => {
      subscribedTo.add(name);
      return of(value);
    });

  const notification = (id: number, over: Partial<Notification> = {}): Notification => {
    const built = new Notification();
    built.id = id;
    built.message = `notification ${id}`;
    built.link = `/projects/${id}/dashboard`;
    built.notificationType = 'feedback';
    built.readAt = null;
    built.createdAt = new Date(2026, 7, 17, 9, 0, 0);
    return Object.assign(built, over);
  };

  const bell = (): HTMLElement => fixture.nativeElement.querySelector('button');

  // What is drawn, not what was bound. Material always renders the content
  // span and hides the whole badge with a class on the host, so the number on
  // screen and whether anyone can see it are two separate questions.
  const badgeText = (): string =>
    fixture.nativeElement.querySelector('.mat-badge-content').textContent.trim();

  const badgeIsHidden = (): boolean =>
    fixture.debugElement
      .query(By.directive(MatBadge))
      .nativeElement.classList.contains('mat-badge-hidden');

  const openMenu = (): void => {
    bell().click();
    fixture.detectChanges();
  };

  // Reads the list a second time without going through the trigger, which is
  // what reopening the menu does.
  const reopenWith = (): Subject<Notification[]> => {
    const refresh: Subject<Notification[]> = new Subject();
    notificationService.list.mockReturnValue(refresh);
    component.onMenuOpened();
    fixture.detectChanges();
    return refresh;
  };

  // The menu panel is not inside the component, it is in the cdk overlay
  // container, so nothing in the dropdown can be found through the fixture.
  const panel = (): HTMLElement => overlayContainer.getContainerElement();

  const rows = (): HTMLElement[] => Array.from(panel().querySelectorAll('.notification-row'));

  const rowText = (): string[] =>
    rows().map((row) => row.querySelector('.notification-message').textContent.trim());

  const glyphIcons = (): string[] =>
    Array.from(panel().querySelectorAll('.notification-glyph mat-icon')).map((icon) =>
      icon.textContent.trim(),
    );

  // The tone class, not the computed colour. jsdom applies no stylesheet, and
  // the class is the contract between the template and the scss anyway.
  const glyphTones = (): string[] =>
    Array.from(panel().querySelectorAll('.notification-glyph')).map((glyph) =>
      Array.from(glyph.classList).find((name) => name.startsWith('tone-')),
    );

  const placeholderText = (): string =>
    Array.from(panel().querySelectorAll('.notification-empty'))
      .map((element) => element.textContent.trim())
      .join(' ');

  beforeEach(async () => {
    unreadCount = new BehaviorSubject<number>(0);
    routerEvents = new Subject<NavigationEnd>();
    list = new Subject<Notification[]>();
    subscribedTo = new Set<string>();

    notificationService = {
      unreadCount$: unreadCount,
      refreshUnreadCount: vi.fn(() => answers('refreshUnreadCount', 0)),
      list: vi.fn().mockReturnValue(list),
      markRead: vi.fn(() => answers('markRead', undefined)),
      markAllRead: vi.fn(() => answers('markAllRead', undefined)),
      remove: vi.fn(() => answers('remove', undefined)),
    };
    completeAuthentication = () => undefined;

    authenticationService = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      afterAuthCall: vi.fn((callback: (authenticated: boolean) => void) => {
        completeAuthentication = callback;
      }),
    };
    confirmationModal = {show: vi.fn()};
    alerts = {success: vi.fn(), error: vi.fn()};
    router = {events: routerEvents.asObservable(), navigateByUrl: vi.fn()};
    notificationRoutes = {navigate: vi.fn().mockResolvedValue(true)};

    await TestBed.configureTestingModule({
      declarations: [NotificationBellComponent],
      imports: [
        MatBadgeModule,
        MatButtonModule,
        MatIconModule,
        MatListModule,
        MatMenuModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        NoopAnimationsModule,
      ],
      providers: [
        {provide: NotificationService, useValue: notificationService},
        {provide: AuthenticationService, useValue: authenticationService},
        {provide: ConfirmationModalService, useValue: confirmationModal},
        {provide: AlertService, useValue: alerts},
        {provide: Router, useValue: router},
        {provide: NotificationRouteService, useValue: notificationRoutes},
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    fixture = TestBed.createComponent(NotificationBellComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('shows how many are unread', () => {
    unreadCount.next(3);
    fixture.detectChanges();

    expect(badgeText()).toBe('3');
    expect(badgeIsHidden()).toBe(false);

    // The service is the only source of the number, so a change made anywhere
    // in the app has to reach the bell without it asking.
    unreadCount.next(4);
    fixture.detectChanges();

    expect(badgeText()).toBe('4');
  });

  it('shows no badge at all when nothing is unread', () => {
    fixture.detectChanges();

    // Not a badge reading zero. A zero sitting on the bell is a permanent
    // little alarm that never means anything.
    expect(badgeIsHidden()).toBe(true);

    unreadCount.next(1);
    fixture.detectChanges();

    expect(badgeIsHidden()).toBe(false);
  });

  it('says how many are unread to a screen reader too', () => {
    fixture.detectChanges();

    expect(bell().getAttribute('aria-label')).toBe('Notifications');

    unreadCount.next(4);
    fixture.detectChanges();

    // Material renders the badge into a span marked aria-hidden, so without
    // this the count is the one thing the control exists to say and the only
    // thing it does not say.
    expect(bell().getAttribute('aria-label')).toBe('Notifications, 4 unread');
  });

  it('asks for the count again after every navigation', () => {
    fixture.detectChanges();

    // Once on init, because unreadCount$ starts at zero whether or not that is
    // true.
    expect(notificationService.refreshUnreadCount).toHaveBeenCalledTimes(1);
    expect(subscribedTo.has('refreshUnreadCount')).toBe(true);

    routerEvents.next(new NavigationEnd(1, '/home', '/home'));
    expect(notificationService.refreshUnreadCount).toHaveBeenCalledTimes(2);

    routerEvents.next(new NavigationEnd(2, '/units/1/tasks/inbox', '/units/1/tasks/inbox'));
    expect(notificationService.refreshUnreadCount).toHaveBeenCalledTimes(3);
  });

  it('does not ask for the count when nobody is signed in', () => {
    authenticationService.isAuthenticated.mockReturnValue(false);

    fixture.detectChanges();
    routerEvents.next(new NavigationEnd(1, '/sign_in', '/sign_in'));

    // Sign out hides the header and routes, and the hiding takes a change
    // detection pass while the routing event does not, so this component can
    // still be alive for it. Anonymous, the request comes back 403, and
    // HttpErrorInterceptor treats a 403 on an anonymous user as an expired
    // session: an "Authentication timed out" alert and a redirect to /timeout.
    expect(notificationService.refreshUnreadCount).not.toHaveBeenCalled();
  });

  it('stops asking once it is destroyed', () => {
    fixture.detectChanges();
    expect(notificationService.refreshUnreadCount).toHaveBeenCalledTimes(1);

    fixture.destroy();
    routerEvents.next(new NavigationEnd(1, '/home', '/home'));

    expect(notificationService.refreshUnreadCount).toHaveBeenCalledTimes(1);
  });

  it('waits for restored authentication before the initial refresh', () => {
    authenticationService.isAuthenticated.mockReturnValue(false);

    fixture.detectChanges();

    expect(authenticationService.afterAuthCall).toHaveBeenCalledTimes(1);
    expect(notificationService.refreshUnreadCount).not.toHaveBeenCalled();

    authenticationService.isAuthenticated.mockReturnValue(true);
    completeAuthentication(true);

    expect(notificationService.refreshUnreadCount).toHaveBeenCalledTimes(1);
    expect(subscribedTo.has('refreshUnreadCount')).toBe(true);
  });

  it('does not refresh after delayed authentication once destroyed', () => {
    authenticationService.isAuthenticated.mockReturnValue(false);

    fixture.detectChanges();
    fixture.destroy();

    authenticationService.isAuthenticated.mockReturnValue(true);
    completeAuthentication(true);

    expect(notificationService.refreshUnreadCount).not.toHaveBeenCalled();
  });

  it('handles a count request that fails instead of leaving it unhandled', async () => {
    // rxjs does not throw an unhandled subscriber error where the subscribe
    // call was, it hands it to config.onUnhandledError a macrotask later, and
    // the default for that is to rethrow globally. Swapping it for a spy is the
    // only way to see the difference from inside a test, and without it this
    // passes whether or not the error is handled at all.
    const unhandled = vi.fn();
    const previous = config.onUnhandledError;
    config.onUnhandledError = unhandled;

    try {
      notificationService.refreshUnreadCount.mockReturnValue(
        throwError(() => new Error('unread_count failed')),
      );

      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(unhandled).not.toHaveBeenCalled();
      expect(component.unreadCount).toBe(0);
    } finally {
      config.onUnhandledError = previous;
    }
  });

  describe('the dropdown', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('does not request the list before authentication is ready', () => {
      authenticationService.isAuthenticated.mockReturnValue(false);

      openMenu();

      expect(notificationService.list).not.toHaveBeenCalled();
      expect(placeholderText()).toContain('We could not load your notifications');
    });

    it('reads the list every time it is opened', () => {
      expect(notificationService.list).not.toHaveBeenCalled();

      openMenu();
      expect(notificationService.list).toHaveBeenCalledTimes(1);

      list.next([notification(1)]);
      fixture.detectChanges();

      // Closing and opening again has to go back to the api. A list fetched
      // once at sign in would be wrong for the rest of the session.
      component.onMenuOpened();
      expect(notificationService.list).toHaveBeenCalledTimes(2);
    });

    it('shows the newest few, newest first', () => {
      openMenu();

      const at = (hour: number) => new Date(2026, 7, 17, hour, 0, 0);
      list.next([
        notification(1, {createdAt: at(9)}),
        notification(2, {createdAt: at(14)}),
        notification(3, {createdAt: at(11)}),
        notification(4, {createdAt: at(15)}),
        notification(5, {createdAt: at(10)}),
        notification(6, {createdAt: at(13)}),
        notification(7, {createdAt: at(12)}),
      ]);
      fixture.detectChanges();

      expect(rowText()).toEqual([
        'notification 4',
        'notification 2',
        'notification 6',
        'notification 7',
        'notification 3',
      ]);
    });

    it('makes each row a real button so a keyboard can open it', () => {
      openMenu();
      list.next([notification(1)]);
      fixture.detectChanges();

      // Structural, and it has to be. MatMenu's key manager only moves focus,
      // it never synthesises a click, so Enter on a row works only because the
      // element is natively a button. The test environment does not simulate
      // that browser behaviour either, so the element type is the assertion.
      expect(rows()[0].tagName).toBe('BUTTON');
    });

    it('gives each category its own icon and colour', () => {
      openMenu();
      list.next([
        notification(1, {notificationType: 'feedback'}),
        notification(2, {notificationType: 'task'}),
        notification(3, {notificationType: 'portfolio'}),
        notification(4, {notificationType: 'extension'}),
        notification(5, {notificationType: 'general'}),
      ]);
      fixture.detectChanges();

      expect(glyphIcons()).toEqual([
        'chat_bubble',
        'assignment',
        'collections_bookmark',
        'more_time',
        'campaign',
      ]);

      // The tone is what the stylesheet colours on, so a row with the right
      // icon and the wrong tone still looks wrong.
      expect(glyphTones()).toEqual([
        'tone-feedback',
        'tone-task',
        'tone-portfolio',
        'tone-extension',
        'tone-general',
      ]);
    });

    it('still draws something for a category it has never heard of', () => {
      openMenu();
      // Notification::TYPES is validated on the api, so this is a sixth
      // category added there reaching a browser running older web code. A row
      // with no icon at all is worse than a generic one.
      list.next([notification(1, {notificationType: 'announcement'})]);
      fixture.detectChanges();

      expect(glyphIcons()).toEqual(['notifications']);
      expect(glyphTones()).toEqual(['tone-general']);
    });

    it('marks the unread rows with a dot and leaves the read ones a gap', () => {
      openMenu();
      list.next([notification(1), notification(2, {readAt: new Date(2026, 7, 17, 9, 30, 0)})]);
      fixture.detectChanges();

      const dots = Array.from(panel().querySelectorAll('.notification-unread-dot'));

      // Both rows keep the element. Removing it on read would shuffle the
      // delete button sideways from row to row.
      expect(dots).toHaveLength(2);
      expect(dots[0].classList.contains('is-read')).toBe(false);
      expect(dots[1].classList.contains('is-read')).toBe(true);
    });

    it('says unread in words, not only in bold and colour', () => {
      openMenu();
      list.next([
        notification(1, {message: 'Andrew Cain commented on 1.1P.'}),
        notification(2, {
          message: 'Your extension was granted.',
          readAt: new Date(2026, 7, 17, 9, 30, 0),
        }),
      ]);
      fixture.detectChanges();

      // Weight and a dot are both things you have to be able to see.
      expect(rows()[0].getAttribute('aria-label')).toContain('Unread.');
      expect(rows()[0].getAttribute('aria-label')).toContain('Andrew Cain commented on 1.1P.');
      expect(rows()[1].getAttribute('aria-label')).toContain('Read.');
    });

    it('says how long ago each one arrived', () => {
      openMenu();

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      list.next([notification(1, {createdAt: twoHoursAgo})]);
      fixture.detectChanges();

      expect(rows()[0].querySelector('.notification-time').textContent.trim()).toBe('2 hours ago');
    });

    it('says something friendly when there is nothing to show', () => {
      openMenu();

      list.next([]);
      fixture.detectChanges();

      expect(rows()).toHaveLength(0);
      expect(placeholderText()).toContain('You are all caught up');
    });

    it('says it could not load rather than claiming there is nothing', () => {
      openMenu();

      list.error(new Error('GET /notifications failed'));
      fixture.detectChanges();

      // The whole point of this one. An empty box after a failed request tells
      // the user they have no notifications, which is a different and wrong
      // thing to say.
      expect(placeholderText()).toContain('could not load');
      expect(placeholderText()).not.toContain('caught up');
    });

    it('shows the list it already has while it reads a fresh one', () => {
      openMenu();
      list.next([notification(1)]);
      fixture.detectChanges();

      // Reopening starts a second read. Blanking the panel for it would make
      // every open flash, when what is on screen is still nearly right.
      reopenWith();

      expect(rowText()).toEqual(['notification 1']);
    });

    it('warns that the rows are stale when a refresh fails behind them', () => {
      openMenu();
      list.next([notification(1)]);
      fixture.detectChanges();

      reopenWith().error(new Error('GET /notifications failed'));
      fixture.detectChanges();

      // Keeping the rows is right, keeping them silently is not. A list nobody
      // could refresh looks exactly like a list nothing has happened to.
      expect(rowText()).toEqual(['notification 1']);
      expect(panel().textContent).toContain('may be out of date');
    });

    it('marks a row read and follows its link when it is clicked', () => {
      openMenu();
      list.next([notification(1, {link: '/projects/9/dashboard'})]);
      fixture.detectChanges();

      rows()[0].click();

      expect(notificationService.markRead).toHaveBeenCalledTimes(1);
      expect(notificationService.markRead.mock.calls[0][0].id).toBe(1);
      expect(subscribedTo.has('markRead')).toBe(true);
      expect(notificationRoutes.navigate).toHaveBeenCalledWith('/projects/9/dashboard');
    });

    it('does not mark a row read twice', () => {
      openMenu();
      list.next([notification(1, {readAt: new Date(2026, 7, 17, 9, 30, 0)})]);
      fixture.detectChanges();

      rows()[0].click();

      // read_all and mark_read are both no-ops on the api for one already read,
      // so a second call would do nothing except tell the service to take one
      // off a count that never included it.
      expect(notificationService.markRead).not.toHaveBeenCalled();
      expect(notificationRoutes.navigate).toHaveBeenCalledTimes(1);
    });

    it('marks a row read even when it has nowhere to go', () => {
      openMenu();
      list.next([notification(1, {link: null})]);
      fixture.detectChanges();

      rows()[0].click();

      // link is nullable on the api. Refusing to mark it read would leave a
      // number on the bell that the user has no way to clear.
      expect(notificationService.markRead).toHaveBeenCalledTimes(1);
      expect(notificationRoutes.navigate).not.toHaveBeenCalled();
    });

    it('says so when a notification could not be marked as read', () => {
      notificationService.markRead.mockReturnValue(throwError(() => new Error('PUT read failed')));

      openMenu();
      list.next([notification(1, {link: null})]);
      fixture.detectChanges();

      rows()[0].click();

      // Nothing else on screen changes when this fails. Swallowing it leaves
      // the row unread and the badge where it was with no explanation.
      expect(alerts.error).toHaveBeenCalledTimes(1);
    });

    it('drops a list read still in flight when a row is opened', () => {
      openMenu();
      list.next([notification(1)]);
      fixture.detectChanges();

      // The rows on screen during a refresh are the previous list's, so this is
      // the ordinary way to reach this: reopen, click before the read lands.
      const refresh = reopenWith();
      expect(refresh.observed).toBe(true);

      rows()[0].click();

      // That response was worked out before the click and NotificationService
      // writes list responses into the shared entity cache, so letting it land
      // would put readAt back to null and draw the row unread again.
      expect(refresh.observed).toBe(false);
    });
  });
  /**
   * The split that matters here is which action asks first. Marking read
   * destroys nothing and a dialog on it is a step to click through; delete has
   * no undo anywhere in this feature and gets one.
   */
  describe('the bulk actions', () => {
    // The dialog is a callback, not a promise. show() is handed the function to
    // run on confirm and the one to run on cancel, so a test drives it by
    // reaching for whichever of those it wants.
    const confirmed = (): void => confirmationModal.show.mock.calls[0][2]();
    const cancelled = (): void => confirmationModal.show.mock.calls[0][3]();

    const deleteButtons = (): HTMLElement[] =>
      Array.from(panel().querySelectorAll('.notification-delete'));

    const markAllButton = (): HTMLElement => panel().querySelector('.notification-mark-all');

    const seeAllButton = (): HTMLElement => panel().querySelector('.notification-see-all');

    beforeEach(() => {
      fixture.detectChanges();
      openMenu();
      list.next([notification(1), notification(2, {readAt: new Date(2026, 7, 17, 9, 30, 0)})]);
      fixture.detectChanges();
    });

    it('registers every dropdown action in MatMenu keyboard order', () => {
      unreadCount.next(1);
      fixture.detectChanges();

      const menuItems = Array.from(panel().querySelectorAll<HTMLElement>('[role="menuitem"]'));

      expect(menuItems).toHaveLength(6);
      expect(menuItems[0]).toBe(markAllButton());
      expect(menuItems[1]).toBe(rows()[0]);
      expect(menuItems[2]).toBe(deleteButtons()[0]);
      expect(menuItems[3]).toBe(rows()[1]);
      expect(menuItems[4]).toBe(deleteButtons()[1]);
      expect(menuItems[5]).toBe(seeAllButton());

      for (const menuItem of menuItems) {
        expect(menuItem.classList.contains('mat-mdc-menu-item')).toBe(true);
      }
    });

    it('names each delete action after the notification it removes', () => {
      expect(deleteButtons().map((button) => button.getAttribute('aria-label'))).toEqual([
        'Delete notification: notification 1',
        'Delete notification: notification 2',
      ]);
    });

    it('marks everything read without asking first', () => {
      unreadCount.next(1);
      fixture.detectChanges();

      // MatMenu closes the panel from a click handler on the panel itself, so
      // anything that reaches it shuts the menu. The whole reward for this
      // button is watching the rows stop being bold, and that is gone if the
      // menu closes underneath it. Watching the click arrive is steadier than
      // watching the overlay leave, which is animation timing.
      const reachedThePanel = vi.fn();
      panel().addEventListener('click', reachedThePanel);

      markAllButton().click();
      fixture.detectChanges();

      expect(notificationService.markAllRead).toHaveBeenCalledTimes(1);
      expect(subscribedTo.has('markAllRead')).toBe(true);
      expect(confirmationModal.show).not.toHaveBeenCalled();
      expect(reachedThePanel).not.toHaveBeenCalled();
    });

    it('does not offer to mark all read when nothing is unread', () => {
      unreadCount.next(0);
      fixture.detectChanges();

      // Same reason the badge disappears at zero rather than showing one. An
      // action that cannot do anything should not be sitting there.
      expect(markAllButton()).toBeNull();

      unreadCount.next(2);
      fixture.detectChanges();

      expect(markAllButton()).not.toBeNull();
    });

    it('says so when marking everything read fails', () => {
      unreadCount.next(1);
      fixture.detectChanges();
      notificationService.markAllRead.mockReturnValue(
        throwError(() => new Error('PUT read_all failed')),
      );

      markAllButton().click();

      expect(alerts.error).toHaveBeenCalledTimes(1);
    });

    it('asks before it deletes anything', () => {
      deleteButtons()[0].click();

      expect(confirmationModal.show).toHaveBeenCalledTimes(1);
      expect(notificationService.remove).not.toHaveBeenCalled();
    });

    it('deletes only once the dialog is agreed to', () => {
      deleteButtons()[0].click();
      confirmed();

      expect(notificationService.remove).toHaveBeenCalledTimes(1);
      expect(notificationService.remove.mock.calls[0][0].id).toBe(1);
      expect(subscribedTo.has('remove')).toBe(true);

      fixture.detectChanges();
      expect(rowText()).toEqual(['notification 2']);
    });

    it('leaves the notification alone when the dialog is cancelled', () => {
      deleteButtons()[0].click();
      cancelled();
      fixture.detectChanges();

      expect(notificationService.remove).not.toHaveBeenCalled();
      expect(rowText()).toEqual(['notification 1', 'notification 2']);
    });

    it('keeps the row when the delete fails', () => {
      notificationService.remove.mockReturnValue(throwError(() => new Error('DELETE failed')));

      deleteButtons()[0].click();
      confirmed();
      fixture.detectChanges();

      // Taking the row out first and putting it back on failure would be worse
      // than leaving it. The user reads the row vanishing as the delete having
      // worked.
      expect(rowText()).toEqual(['notification 1', 'notification 2']);
      expect(alerts.error).toHaveBeenCalledTimes(1);
    });

    it('does not open the notification when its delete button is clicked', () => {
      deleteButtons()[0].click();

      // The delete button sits in the row, and the row opens the notification.
      // Without stopping the click there, asking to delete one would mark it
      // read and navigate away from the menu it was asked in.
      expect(notificationService.markRead).not.toHaveBeenCalled();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('promotes the next notification when a shown one is deleted', () => {
      const at = (hour: number) => new Date(2026, 7, 17, hour, 0, 0);
      const refresh = reopenWith();
      refresh.next([
        notification(1, {createdAt: at(15)}),
        notification(2, {createdAt: at(14)}),
        notification(3, {createdAt: at(13)}),
        notification(4, {createdAt: at(12)}),
        notification(5, {createdAt: at(11)}),
        notification(6, {createdAt: at(10)}),
      ]);
      fixture.detectChanges();

      expect(rowText()).toHaveLength(5);
      expect(rowText()).not.toContain('notification 6');

      deleteButtons()[0].click();
      confirmed();
      fixture.detectChanges();

      // Filtering only the five on screen would leave four and a gap, when the
      // sixth is already in hand and nothing needs to be asked for.
      expect(rowText()).toEqual([
        'notification 2',
        'notification 3',
        'notification 4',
        'notification 5',
        'notification 6',
      ]);
    });

    it('drops a list read still in flight when everything is marked read', () => {
      unreadCount.next(1);
      fixture.detectChanges();

      const refresh = reopenWith();
      expect(refresh.observed).toBe(true);

      markAllButton().click();

      expect(refresh.observed).toBe(false);
    });

    it('offers a way to the rest of them', () => {
      // The dropdown shows five and the api sends every one, so without this a
      // sixth notification can only be reached by typing a url.
      seeAllButton().click();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/notifications');
    });
  });
});
