import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatTooltipModule} from '@angular/material/tooltip';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Router} from '@angular/router';
import {Observable, Subject, defer, of, throwError} from 'rxjs';
import {Notification} from 'src/app/api/models/notification';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {NotificationRouteService} from 'src/app/api/services/notification-route.service';
import {NotificationService} from 'src/app/api/services/notification.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {ConfirmationModalService} from '../modals/confirmation-modal/confirmation-modal.service';
import {NotificationsPageComponent} from './notifications-page.component';

/**
 * Three of these are the states the ticket names, loading, empty and the list
 * itself, and they are tested through the rendered page because that is where
 * the difference between them lives. The fourth is the one the ticket does not
 * name and is the same trap as in the dropdown: a request that failed must not
 * be drawn as a user with no notifications.
 *
 * The paging tests drive the real paginator rather than calling onPage, so the
 * binding between them counts. They hold the api at arm's length deliberately:
 * there is one fetch and one only, and every page after the first has to come
 * out of what is already here.
 */
describe('NotificationsPageComponent', () => {
  let component: NotificationsPageComponent;
  let fixture: ComponentFixture<NotificationsPageComponent>;

  let list: Subject<Notification[]>;
  let subscribedTo: Set<string>;
  let notificationService: {
    list: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
    markAllRead: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let authenticationService: {afterAuthCall: ReturnType<typeof vi.fn>};
  let confirmationModal: {show: ReturnType<typeof vi.fn>};
  let alerts: {success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>};
  let router: {navigateByUrl: ReturnType<typeof vi.fn>};
  let notificationRoutes: {navigate: ReturnType<typeof vi.fn>};

  /**
   * A stand-in that records whether anybody actually subscribed.
   *
   * A spy that only counts calls is happy either way, and markRead returns a
   * cold observable, so dropping the .subscribe() sends no request at all while
   * the call count stays exactly the same.
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
    // Newest id first, so a page of them reads in a checkable order.
    built.createdAt = new Date(2026, 0, 1, 0, 0, id);
    return Object.assign(built, over);
  };

  const many = (count: number): Notification[] =>
    Array.from({length: count}, (_unused, index) => notification(count - index));

  const rows = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.notification-row'));

  const rowText = (): string[] =>
    rows().map((row) => row.querySelector('.notification-message').textContent.trim());

  const pageText = (): string => fixture.nativeElement.textContent;

  const paginator = (): MatPaginator =>
    fixture.debugElement.query(By.directive(MatPaginator)).componentInstance;

  beforeEach(async () => {
    list = new Subject<Notification[]>();
    subscribedTo = new Set<string>();

    notificationService = {
      list: vi.fn().mockReturnValue(list),
      markRead: vi.fn(() => answers('markRead', undefined)),
      markAllRead: vi.fn(() => answers('markAllRead', undefined)),
      remove: vi.fn(() => answers('remove', undefined)),
    };
    // Signed in and settled, unless a test says otherwise.
    authenticationService = {afterAuthCall: vi.fn((callback) => callback(true))};
    confirmationModal = {show: vi.fn()};
    alerts = {success: vi.fn(), error: vi.fn()};
    router = {navigateByUrl: vi.fn()};
    notificationRoutes = {navigate: vi.fn().mockResolvedValue(true)};

    await TestBed.configureTestingModule({
      declarations: [NotificationsPageComponent],
      imports: [
        MatButtonModule,
        MatIconModule,
        MatListModule,
        MatPaginatorModule,
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

    fixture = TestBed.createComponent(NotificationsPageComponent);
    component = fixture.componentInstance;
  });

  it('says it is loading before the list arrives', () => {
    fixture.detectChanges();

    expect(pageText()).toContain('Loading your notifications');
    expect(rows()).toHaveLength(0);

    list.next([notification(1)]);
    fixture.detectChanges();

    expect(pageText()).not.toContain('Loading your notifications');
    expect(rows()).toHaveLength(1);
  });

  it('says something friendly when there is nothing to show', () => {
    fixture.detectChanges();

    list.next([]);
    fixture.detectChanges();

    expect(pageText()).toContain('You have no notifications yet');
    expect(rows()).toHaveLength(0);
  });

  it('says it could not load rather than claiming there is nothing', () => {
    fixture.detectChanges();

    list.error(new Error('GET /notifications failed'));
    fixture.detectChanges();

    expect(pageText()).toContain('could not load');
    expect(pageText()).not.toContain('You have no notifications yet');
  });

  it('reads the list again when the retry is clicked', () => {
    fixture.detectChanges();
    list.error(new Error('GET /notifications failed'));
    fixture.detectChanges();

    list = new Subject<Notification[]>();
    notificationService.list.mockReturnValue(list);

    fixture.nativeElement.querySelector('.notifications-retry').click();
    fixture.detectChanges();

    expect(notificationService.list).toHaveBeenCalledTimes(2);
    expect(pageText()).toContain('Loading your notifications');

    list.next([notification(1)]);
    fixture.detectChanges();

    expect(rowText()).toEqual(['notification 1']);
  });

  it('shows the newest first', () => {
    fixture.detectChanges();

    list.next([notification(1), notification(3), notification(2)]);
    fixture.detectChanges();

    expect(rowText()).toEqual(['notification 3', 'notification 2', 'notification 1']);
  });

  it('makes each row a real button so a keyboard can open it', () => {
    fixture.detectChanges();
    list.next([notification(1)]);
    fixture.detectChanges();

    // Structural, and it has to be. A mat-list-item on its own is static list
    // content: no focus, no Enter, no Space. Only the element type gives the
    // row those, and the test environment does not simulate the browser
    // behaviour that would let this be asserted any other way.
    expect(rows()[0].tagName).toBe('BUTTON');
  });

  it('gives each category the same icon and colour the dropdown gives it', () => {
    fixture.detectChanges();
    list.next([
      notification(5, {notificationType: 'feedback'}),
      notification(4, {notificationType: 'task'}),
      notification(3, {notificationType: 'portfolio'}),
      notification(2, {notificationType: 'extension'}),
      notification(1, {notificationType: 'general'}),
    ]);
    fixture.detectChanges();

    const glyphs: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.notification-glyph'),
    );

    expect(glyphs.map((g) => g.querySelector('mat-icon').textContent.trim())).toEqual([
      'chat_bubble',
      'assignment',
      'collections_bookmark',
      'more_time',
      'campaign',
    ]);
    expect(glyphs.map((g) => Array.from(g.classList).find((n) => n.startsWith('tone-')))).toEqual([
      'tone-feedback',
      'tone-task',
      'tone-portfolio',
      'tone-extension',
      'tone-general',
    ]);
  });

  it('still draws something for a category it has never heard of', () => {
    fixture.detectChanges();
    list.next([notification(1, {notificationType: 'announcement'})]);
    fixture.detectChanges();

    const glyph = fixture.nativeElement.querySelector('.notification-glyph');

    expect(glyph.querySelector('mat-icon').textContent.trim()).toBe('notifications');
    expect(Array.from(glyph.classList)).toContain('tone-general');
  });

  it('says unread in words, not only in bold', () => {
    fixture.detectChanges();
    list.next([
      notification(2, {message: 'Andrew Cain commented on 1.1P.'}),
      notification(1, {message: 'Your extension was granted.', readAt: new Date(2026, 0, 2)}),
    ]);
    fixture.detectChanges();

    expect(rows()[0].getAttribute('aria-label')).toContain('Unread.');
    expect(rows()[1].getAttribute('aria-label')).toContain('Read.');
  });

  it('shows one page at a time out of a single fetch', () => {
    fixture.detectChanges();

    list.next(many(45));
    fixture.detectChanges();

    expect(rows()).toHaveLength(20);
    expect(rowText()[0]).toBe('notification 45');
    expect(paginator().length).toBe(45);

    // Through the paginator and not through onPage. Calling the handler
    // directly passes just as well with the (page) binding deleted, and then
    // the real Next button does nothing.
    paginator().nextPage();
    fixture.detectChanges();

    expect(rowText()[0]).toBe('notification 25');
    expect(rows()).toHaveLength(20);

    // The last page is the short one, and it is where an off by one shows up.
    paginator().nextPage();
    fixture.detectChanges();

    expect(rows()).toHaveLength(5);
    expect(rowText()).toEqual([
      'notification 5',
      'notification 4',
      'notification 3',
      'notification 2',
      'notification 1',
    ]);

    // One request for the whole thing. Paging is over what is already here,
    // because the api has no page parameters to send.
    expect(notificationService.list).toHaveBeenCalledTimes(1);
  });

  it('follows a change of page size', () => {
    fixture.detectChanges();
    list.next(many(45));
    fixture.detectChanges();

    paginator()._changePageSize(50);
    fixture.detectChanges();

    expect(rows()).toHaveLength(45);
  });

  it('does not strand the reader past the end when a reload is shorter', () => {
    fixture.detectChanges();
    list.next(many(45));
    fixture.detectChanges();

    paginator().nextPage();
    paginator().nextPage();
    fixture.detectChanges();
    expect(rows()).toHaveLength(5);

    // Same page number, far fewer notifications behind it. Left alone this
    // renders an empty page with a paginator insisting it is page three of one.
    list = new Subject<Notification[]>();
    notificationService.list.mockReturnValue(list);
    component.load();
    list.next(many(4));
    fixture.detectChanges();

    expect(component.pageIndex).toBe(0);
    expect(rows()).toHaveLength(4);
  });

  it('marks a row read and follows its link when it is clicked', () => {
    fixture.detectChanges();
    list.next([notification(1, {link: '/projects/9/dashboard'})]);
    fixture.detectChanges();

    rows()[0].click();

    expect(notificationService.markRead).toHaveBeenCalledTimes(1);
    expect(notificationService.markRead.mock.calls[0][0].id).toBe(1);
    expect(subscribedTo.has('markRead')).toBe(true);
    expect(notificationRoutes.navigate).toHaveBeenCalledWith('/projects/9/dashboard');
  });

  it('does not mark a row read twice', () => {
    fixture.detectChanges();
    list.next([notification(1, {readAt: new Date(2026, 0, 2)})]);
    fixture.detectChanges();

    rows()[0].click();

    expect(notificationService.markRead).not.toHaveBeenCalled();
    expect(notificationRoutes.navigate).toHaveBeenCalledTimes(1);
  });

  it('marks a row read even when it has nowhere to go', () => {
    fixture.detectChanges();
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

    fixture.detectChanges();
    list.next([notification(1, {link: null})]);
    fixture.detectChanges();

    rows()[0].click();

    expect(alerts.error).toHaveBeenCalledTimes(1);
  });

  /**
   * The split that matters is which action asks first. Marking read destroys
   * nothing and a dialog on it is a step to click through; delete has no undo
   * anywhere in this feature and gets one.
   *
   * The one thing here that the dropdown has no version of is the paging. Five
   * rows in a menu have no pages to fall off the end of.
   */
  describe('the bulk actions', () => {
    // The dialog is a callback, not a promise. show() is handed the function to
    // run on confirm and the one to run on cancel, so a test drives it by
    // reaching for whichever of those it wants.
    const confirmed = (): void => confirmationModal.show.mock.calls[0][2]();
    const cancelled = (): void => confirmationModal.show.mock.calls[0][3]();

    const deleteButtons = (): HTMLElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll('.notification-delete'));

    const markAllButton = (): HTMLElement =>
      fixture.nativeElement.querySelector('.notification-mark-all');

    const read = (id: number) => notification(id, {readAt: new Date(2026, 0, 2)});

    // Swap in a fresh list request and reload through it, so a test can hold the
    // second response open or answer it with something different.
    const reloadWith = (): Subject<Notification[]> => {
      const refresh: Subject<Notification[]> = new Subject();
      notificationService.list.mockReturnValue(refresh);
      component.load();
      fixture.detectChanges();
      return refresh;
    };

    beforeEach(() => {
      fixture.detectChanges();
      list.next([notification(2), read(1)]);
      fixture.detectChanges();
    });

    it('marks everything read without asking first', () => {
      component.markAllRead();

      expect(notificationService.markAllRead).toHaveBeenCalledTimes(1);
      expect(subscribedTo.has('markAllRead')).toBe(true);
      expect(confirmationModal.show).not.toHaveBeenCalled();
      expect(alerts.success).toHaveBeenCalledWith('All notifications marked as read');
    });

    it('keeps the focused action available but disabled when nothing is unread', () => {
      const refresh = reloadWith();
      refresh.next([read(2), read(1)]);
      fixture.detectChanges();

      expect(markAllButton()).not.toBeNull();
      expect(markAllButton().getAttribute('aria-disabled')).toBe('true');

      component.markAllRead();

      expect(notificationService.markAllRead).not.toHaveBeenCalled();
    });

    it('does not send mark all read twice while the request is pending', () => {
      const pending: Subject<void> = new Subject();
      notificationService.markAllRead.mockReturnValue(pending);

      component.markAllRead();
      component.markAllRead();

      expect(notificationService.markAllRead).toHaveBeenCalledTimes(1);
      expect(component.markAllReadPending).toBe(true);

      pending.next();

      expect(component.markAllReadPending).toBe(false);
    });

    it('keeps focus on mark all read after the rows become read', () => {
      notificationService.markAllRead.mockImplementation(() =>
        defer(() => {
          component.notifications.forEach((row) => (row.readAt = new Date()));
          return of(undefined);
        }),
      );

      const button = markAllButton();
      button.focus();
      button.click();
      fixture.detectChanges();

      expect(document.activeElement).toBe(button);
      expect(button.getAttribute('aria-disabled')).toBe('true');
    });

    it('offers it on a phone, where nothing refreshes the shared unread count', () => {
      // The button is drawn from the rows this page loaded and not from
      // NotificationService.unreadCount$. That subject seeds at zero and the
      // only thing that refreshes it is the bell, which the header does not
      // render below xs. Reading it here would hide this button on the one size
      // where this page is the only way to the notifications at all.
      expect(markAllButton()).not.toBeNull();
      expect(notificationService.list).toHaveBeenCalledTimes(1);
    });

    it('says so when marking everything read fails', () => {
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
      expect(confirmationModal.show.mock.calls[0][1]).toContain('notification 2');
    });

    it('deletes only once the dialog is agreed to', () => {
      deleteButtons()[0].click();
      confirmed();

      expect(notificationService.remove).toHaveBeenCalledTimes(1);
      expect(notificationService.remove.mock.calls[0][0].id).toBe(2);
      expect(subscribedTo.has('remove')).toBe(true);

      fixture.detectChanges();
      expect(rowText()).toEqual(['notification 1']);
    });

    it('does not delete the same notification twice while the first request is pending', () => {
      const pending: Subject<void> = new Subject();
      notificationService.remove.mockReturnValue(pending);

      deleteButtons()[0].click();
      confirmed();
      confirmed();
      fixture.detectChanges();

      expect(notificationService.remove).toHaveBeenCalledTimes(1);
      expect(deleteButtons()[0].getAttribute('aria-disabled')).toBe('true');

      pending.next();
      fixture.detectChanges();

      expect(component.isDeleting(notificationService.remove.mock.calls[0][0])).toBe(false);
    });

    it('moves focus to the row that replaces a deleted row', () => {
      const button = deleteButtons()[0];
      button.click();
      button.focus();

      confirmed();

      expect(rowText()).toEqual(['notification 1']);
      expect(document.activeElement).toBe(rows()[0]);
    });

    it('leaves the notification alone when the dialog is cancelled', () => {
      deleteButtons()[0].click();
      cancelled();
      fixture.detectChanges();

      expect(notificationService.remove).not.toHaveBeenCalled();
      expect(rowText()).toEqual(['notification 2', 'notification 1']);
    });

    it('keeps the row when the delete fails', () => {
      notificationService.remove.mockReturnValue(throwError(() => new Error('DELETE failed')));

      const lastPageDelete = deleteButtons()[0];
      lastPageDelete.click();
      lastPageDelete.focus();
      confirmed();
      fixture.detectChanges();

      // Taking the row out first and putting it back on failure would be worse
      // than leaving it. The user reads the row vanishing as the delete having
      // worked.
      expect(rowText()).toEqual(['notification 2', 'notification 1']);
      expect(alerts.error).toHaveBeenCalledTimes(1);
    });

    it('does not open the notification when its delete button is clicked', () => {
      deleteButtons()[0].click();

      // The delete button is a sibling of the row rather than inside it, and
      // that is what keeps this true without stopping the event. Nesting them
      // would make asking to delete one mark it read and navigate away from the
      // page it was asked on.
      expect(notificationService.markRead).not.toHaveBeenCalled();
      expect(notificationRoutes.navigate).not.toHaveBeenCalled();
    });

    it('names the notification on its delete button', () => {
      // Twenty rows means twenty of these buttons. Identical labels leave
      // somebody tabbing through them hearing the same three words over and
      // over with nothing to tell them apart.
      expect(deleteButtons()[0].getAttribute('aria-label')).toBe('Delete: notification 2');
      expect(deleteButtons()[1].getAttribute('aria-label')).toBe('Delete: notification 1');
    });

    it('pulls the reader back when the last row on the last page is deleted', () => {
      const refresh = reloadWith();
      refresh.next(many(21));
      fixture.detectChanges();

      paginator().nextPage();
      fixture.detectChanges();
      expect(rows()).toHaveLength(1);

      deleteButtons()[0].click();
      confirmed();
      fixture.detectChanges();

      // Without the clamp the reader is left on page two of a list that now has
      // one page. That draws no rows at all and does not take the empty state
      // either, because there are still twenty notifications.
      expect(component.pageIndex).toBe(0);
      expect(rows()).toHaveLength(20);
      expect(document.activeElement).toBe(rows()[0]);
    });

    it('shows the empty state once the last one is deleted', () => {
      const refresh = reloadWith();
      refresh.next([notification(1)]);
      fixture.detectChanges();

      deleteButtons()[0].click();
      confirmed();
      fixture.detectChanges();

      expect(pageText()).toContain('You have no notifications yet');
      expect(alerts.success).toHaveBeenCalledTimes(1);
    });

    it('drops a list read still in flight when everything is marked read', () => {
      const refresh = reloadWith();
      expect(refresh.observed).toBe(true);

      component.markAllRead();

      // That response was worked out before the click, and NotificationService
      // writes list responses into the shared entity cache, so letting it land
      // would put readAt back to null on every row.
      expect(refresh.observed).toBe(false);
    });

    it('drops a list read still in flight when one is deleted', () => {
      // Driven through the component rather than the dom, and that is worth a
      // word. A reload replaces the rows with the spinner, so while one is in
      // flight there is no delete button on screen to click, and the sequence
      // this guards cannot be produced by clicking today. It is reachable the
      // moment anything reloads this page on a timer or a navigation, which is
      // what the bell already does to the count, and the response is written
      // into a cache the whole app shares. Cheap guard, real hazard.
      component.confirmDelete(component.visible[0]);
      const refresh = reloadWith();
      expect(refresh.observed).toBe(true);

      confirmed();

      // Worse here than for a mark read. That response still holds the row that
      // was just deleted, so landing late would put it back on screen.
      expect(refresh.observed).toBe(false);
    });

    it('does not leave a spinner over the list when a reload is abandoned', () => {
      reloadWith();
      expect(pageText()).toContain('Loading your notifications');

      component.markAllRead();
      fixture.detectChanges();

      // Cancelling the request without clearing the flag sits a spinner over a
      // list that nothing is going to replace now.
      expect(pageText()).not.toContain('Loading your notifications');
      expect(rows()).toHaveLength(2);
    });
  });

  describe('before anyone is signed in', () => {
    it('asks nothing of the api until authentication has settled', () => {
      let resume: (signedIn: boolean) => void;
      authenticationService.afterAuthCall.mockImplementation((callback) => {
        resume = callback;
      });

      fixture.detectChanges();

      // An anonymous GET /notifications comes back 403, and HttpErrorInterceptor
      // reads a 403 on an anonymous user as an expired session: it alerts
      // "Authentication timed out" and redirects to /timeout. Opening a
      // bookmark while signed out would look like being thrown out.
      expect(notificationService.list).not.toHaveBeenCalled();

      resume(true);
      fixture.detectChanges();

      expect(notificationService.list).toHaveBeenCalledTimes(1);
    });

    it('sends the visitor to sign in instead of asking the api', () => {
      authenticationService.afterAuthCall.mockImplementation((callback) => callback(false));

      fixture.detectChanges();

      expect(notificationService.list).not.toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/sign_in');
    });
  });
});
