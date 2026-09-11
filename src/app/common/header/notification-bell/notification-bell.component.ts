import moment from 'moment';
import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {NavigationEnd, Router} from '@angular/router';
import {Subscription, filter} from 'rxjs';
import {Notification} from 'src/app/api/models/notification';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {NotificationRouteService} from 'src/app/api/services/notification-route.service';
import {NotificationService} from 'src/app/api/services/notification.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {ConfirmationModalService} from '../../modals/confirmation-modal/confirmation-modal.service';

/**
 * The bell in the header, the unread count on it, and the list behind it.
 *
 * Its own component rather than more markup in HeaderComponent. The header is
 * already eleven injected services long and its spec replaces the template with
 * an empty string, so anything added there is untested by construction. This
 * also keeps the change to the header itself to one line.
 *
 * The dropdown lives here rather than in a component of its own, which is the
 * same shape as unit-dropdown and task-dropdown next door. Both of those own
 * their trigger and their mat-menu in one template, and the reason is not
 * tidiness: MatMenu collects its items with a content query, and a content
 * query does not reach into another component's template. Rows in a child
 * component would still click and still close the menu, but the menu's key
 * manager would never see them, so the arrow keys would walk over an empty
 * menu.
 *
 * The count comes from NotificationService.unreadCount$ and not from a request
 * this component makes, so marking one read anywhere in the app moves the badge
 * without the bell knowing who did it.
 */
@Component({
  selector: 'notification-bell',
  templateUrl: './notification-bell.component.html',
  styleUrls: ['./notification-bell.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  /**
   * How many rows the dropdown shows.
   *
   * The api has no paging, GET /notifications answers with the lot, so this is
   * a display limit and not a request size. Somebody with four hundred of them
   * still downloads four hundred, and the full page is where they go to read
   * them.
   */
  public static readonly RECENT_COUNT = 5;

  /**
   * The icon and colour for a notification's category.
   *
   * Keyed on notificationType and nothing finer, because that is all the api
   * sends. NotificationEntity exposes id, notification_type, message, link,
   * read_at and created_at, and the event naming the specific thing that
   * happened is deliberately not among them. So a new task, a due date change
   * and a due soon reminder all share the one task icon. Icons per event would
   * need `expose :event` on the api first, and then this stops being a closed
   * list of five and becomes something every event ticket has to edit, which is
   * the coupling the mailer templates were shaped to avoid.
   */
  private static readonly CATEGORIES: Record<string, {icon: string; tone: string}> = {
    feedback: {icon: 'chat_bubble', tone: 'feedback'},
    task: {icon: 'assignment', tone: 'task'},
    portfolio: {icon: 'collections_bookmark', tone: 'portfolio'},
    extension: {icon: 'more_time', tone: 'extension'},
    general: {icon: 'campaign', tone: 'general'},
  };

  /**
   * For a category this build has not heard of.
   *
   * Notification::TYPES is validated on the api, so the five above are the five
   * that exist today. A sixth added there would reach a browser running older
   * web code, and a row with no icon at all is worse than a generic one.
   */
  private static readonly UNKNOWN_CATEGORY = {icon: 'notifications', tone: 'general'};

  unreadCount = 0;

  /**
   * Everything the last read came back with, newest first.
   *
   * All of it and not just the five on screen. Deleting one of the five has to
   * promote the sixth, and re-reading the list to find out what the sixth was
   * would be a request for something already in hand.
   */
  notifications: Notification[] = [];

  /**
   * The slice actually drawn.
   */
  recent: Notification[] = [];

  loading = false;
  loadFailed = false;

  private subscriptions: Subscription[] = [];
  private listSubscription: Subscription | null = null;
  private destroyed = false;

  constructor(
    private notificationService: NotificationService,
    private authenticationService: AuthenticationService,
    private confirmationModal: ConfirmationModalService,
    private alerts: AlertService,
    private router: Router,
    private notificationRoutes: NotificationRouteService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.notificationService.unreadCount$.subscribe((count) => {
        this.unreadCount = count;
      }),
    );

    // The count goes stale on its own. Notifications are created by the api,
    // and push only reaches a browser that granted permission and kept the
    // service worker alive, so most sessions never hear about a new one. A
    // navigation is the cheapest honest excuse to ask again, and it is roughly
    // when someone would look at the bell anyway.
    this.subscriptions.push(
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe(() => this.refresh()),
    );

    // A remembered session is restored after the header is created. If the bell
    // asks immediately, the authentication guard can skip the request before the
    // restored session is ready, and no later navigation is guaranteed.
    if (this.authenticationService.isAuthenticated()) {
      this.refresh();
    } else {
      this.authenticationService.afterAuthCall((authenticated) => {
        if (authenticated && !this.destroyed) {
          this.refresh();
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.listSubscription?.unsubscribe();
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  /**
   * What a screen reader should call the bell.
   *
   * The badge is not part of it. Material renders the number into a span marked
   * aria-hidden, so a bell with four unread notifications announces itself as
   * "Notifications, button" and the count is the one thing the control exists
   * to say.
   */
  get bellLabel(): string {
    return this.unreadCount ? `Notifications, ${this.unreadCount} unread` : 'Notifications';
  }

  /**
   * Read the list again every time the menu is opened.
   *
   * On the open event and not in ngOnInit. Content written inside a mat-menu is
   * built with the surrounding component whether the menu is ever opened or
   * not, so an ngOnInit here would fetch once at sign in and then show that
   * same list for the rest of the session.
   */
  onMenuOpened(): void {
    this.loading = true;
    this.loadFailed = false;

    if (!this.authenticationService.isAuthenticated()) {
      this.loading = false;
      this.loadFailed = true;
      return;
    }

    // Opening twice quickly is easy to do. Without this the first response can
    // land after the second and put the older list back.
    this.listSubscription?.unsubscribe();

    this.listSubscription = this.notificationService.list().subscribe({
      next: (notifications) => {
        this.notifications = this.newestFirst(notifications);
        this.updateRecent();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  /**
   * Open one notification: mark it read, then go where it points.
   *
   * Marking read is not conditional on the link. A notification with nowhere to
   * go has still been seen once it is clicked, and leaving it unread would keep
   * a number on the bell that the user cannot clear.
   */
  open(notification: Notification): void {
    if (!notification.isRead) {
      // The rows on screen during a refresh are the previous list's, so this is
      // a real sequence and not a theoretical one. That response was worked out
      // before this click and it is written straight into the shared entity
      // cache, so letting it land would put readAt back to null and draw the
      // row unread again.
      this.cancelPendingList();

      // Not waited on. The row is already gone from view by the time this
      // answers, the badge follows from unreadCount$, and holding the
      // navigation for it would make every click feel slow.
      this.notificationService.markRead(notification).subscribe({
        error: () => this.alerts.error('That notification could not be marked as read'),
      });
    }

    if (notification.link) {
      void this.notificationRoutes.navigate(notification.link);
    }
  }

  /**
   * Mark the lot as read.
   *
   * No confirmation. Nothing is lost by it and the user can still read every
   * one of them afterwards, so a dialog here would only be a step to click
   * through. Delete is the one that asks.
   *
   * The count on the bell is not touched here. NotificationService drops it to
   * zero inside markAllRead and pushes that down unreadCount$, which is where
   * the badge reads it from, so a second copy of the arithmetic here could only
   * ever disagree with it.
   */
  markAllRead(event: MouseEvent): void {
    // MatMenu closes on any click that reaches the panel, and closing here
    // would hide the thing the user just asked to see happen. It also has to
    // stop before the row underneath, which would treat this as opening the
    // notification.
    event.stopPropagation();

    // A read that went out before this is now out of date, and its response is
    // written into the shared cache, so landing late would draw every row
    // unread again.
    this.cancelPendingList();

    this.notificationService.markAllRead().subscribe({
      error: () => this.alerts.error('Your notifications could not be marked as read'),
    });
  }

  /**
   * Ask first, then delete.
   *
   * Delete is the only one of the five endpoints that destroys anything, and
   * there is no undo anywhere in this feature, so it gets the dialog the house
   * already has rather than a new one.
   *
   * The empty cancel function is deliberate. ConfirmationModalService pops a
   * green success snackbar reading "<title> action cancelled" when none is
   * given, and telling somebody they successfully did not delete something is
   * noise.
   */
  confirmDelete(notification: Notification, event: MouseEvent): void {
    event.stopPropagation();

    this.confirmationModal.show(
      'Delete notification',
      'This removes the notification. You will not be able to get it back.',
      () => this.remove(notification),
      () => undefined,
      'Delete',
    );
  }

  /**
   * Go to the full list.
   *
   * The dropdown shows five and the api sends every one, so without a way out
   * of it a sixth notification is unreachable except by typing a url.
   *
   * The /notifications route arrives with IN-04, which is a sibling branch, so
   * on this branch alone there is nothing at that path yet and app.routes.ts
   * sends an unmatched path to /home. Both branches merge into
   * feature/notifications before any of this ships.
   */
  seeAll(): void {
    this.router.navigateByUrl('/notifications');
  }

  iconFor(notification: Notification): string {
    return this.categoryFor(notification).icon;
  }

  toneFor(notification: Notification): string {
    return this.categoryFor(notification).tone;
  }

  /**
   * What a screen reader should read for a row.
   *
   * Unread is drawn as bold text and a coloured dot, and both of those are
   * things you have to be able to see. The message and the time are already in
   * the button, so this only exists to put the state into words.
   */
  rowLabel(notification: Notification): string {
    const state = notification.isRead ? 'Read' : 'Unread';

    return `${state}. ${notification.message}. ${this.timeAgo(notification)}`;
  }

  /**
   * How long ago this arrived, in words.
   *
   * Worked out on each change detection pass rather than stored, so a menu left
   * open does not sit there insisting something happened "a few seconds ago"
   * ten minutes later.
   */
  timeAgo(notification: Notification): string {
    return moment(notification.createdAt).fromNow();
  }

  /**
   * Retire a list request that is still in the air.
   *
   * Anything this component changes locally is newer than a read that went out
   * before it. NotificationService writes list responses into the shared cache,
   * so one arriving late does not merely show stale rows, it undoes the change.
   */
  protected cancelPendingList(): void {
    this.listSubscription?.unsubscribe();
    this.listSubscription = null;
    this.loading = false;
  }

  /**
   * Delete it for real, once the dialog has been agreed to.
   *
   * The row is dropped from the held list on success rather than by reading the
   * list again. A second GET for something we already know the answer to would
   * make the row sit there for a round trip after the user asked for it to go.
   * The unread count corrects itself from unreadCount$, the same as everywhere
   * else here.
   */
  private remove(notification: Notification): void {
    this.cancelPendingList();

    this.notificationService.remove(notification).subscribe({
      next: () => {
        this.notifications = this.notifications.filter((row) => row !== notification);

        // Recomputed and not filtered in place. Filtering the five on screen
        // leaves four and a gap, when the sixth newest is sitting right here
        // waiting to move up.
        this.updateRecent();
        this.alerts.success('Notification deleted');
      },
      error: () => this.alerts.error('That notification could not be deleted'),
    });
  }

  /**
   * Newest first.
   *
   * The api already answers in this order, and this sorts anyway. Recency is
   * the entire meaning of this list, and the copies handed back here come out
   * of a cache that other calls also write to, so the order of the array is not
   * something worth trusting.
   */
  private newestFirst(notifications: Notification[]): Notification[] {
    return [...notifications].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private updateRecent(): void {
    this.recent = this.notifications.slice(0, NotificationBellComponent.RECENT_COUNT);
  }

  private categoryFor(notification: Notification): {icon: string; tone: string} {
    return (
      NotificationBellComponent.CATEGORIES[notification.notificationType] ??
      NotificationBellComponent.UNKNOWN_CATEGORY
    );
  }

  /**
   * Ask the api for the count, but only while somebody is signed in.
   *
   * The guard is not tidiness. Sign out hides the header and routes to
   * /sign_in, and hiding is a change detection away while the navigation event
   * fires straight away, so this component can still be alive for it. The
   * request would then go out anonymous, come back 403, and
   * HttpErrorInterceptor reads a 403 on an anonymous user as an expired session:
   * it shows "Authentication timed out" and redirects to /timeout. Signing out
   * would look like being kicked out.
   *
   * Errors are dropped. Nothing the user asked for depends on this.
   */
  private refresh(): void {
    if (!this.authenticationService.isAuthenticated()) {
      return;
    }

    this.notificationService.refreshUnreadCount().subscribe({error: () => undefined});
  }
}
