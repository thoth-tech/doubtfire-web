import moment from 'moment';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {PageEvent} from '@angular/material/paginator';
import {Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {Notification} from 'src/app/api/models/notification';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {NotificationService} from 'src/app/api/services/notification.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {ConfirmationModalService} from '../modals/confirmation-modal/confirmation-modal.service';
import {NotificationOpenService} from '../notifications/notification-open.service';
import {presentationFor} from '../notifications/notification-presentation';

/**
 * The whole notification list, on a page of its own.
 *
 * Lives under common/ next to the other routed components that are not part of
 * a unit or a project, scorm-player and submission-files-download.
 *
 * Paged here and not by the api. GET /notifications takes unread_only and
 * nothing else and answers with every row the user has, so this holds the lot
 * and shows a page of it. That is fine at the sizes this feature produces and
 * it is wrong at some size, which is an api ticket and not this one.
 */
@Component({
  selector: 'f-notifications-page',
  templateUrl: './notifications-page.component.html',
  styleUrls: ['./notifications-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class NotificationsPageComponent implements OnInit, OnDestroy {
  public readonly pageSizeOptions: number[] = [10, 20, 50];

  notifications: Notification[] = [];

  /**
   * The rows actually on screen.
   *
   * Held rather than worked out in the template. A getter that slices would
   * build a new array on every change detection pass, and with a click handler
   * on every row there are a lot of those.
   */
  visible: Notification[] = [];

  loading = true;
  loadFailed = false;

  pageIndex = 0;
  pageSize = 20;

  private listSubscription: Subscription | null = null;
  private readonly deletingNotificationIds: Set<number> = new Set();
  markAllReadPending = false;
  deleteAllPending = false;

  constructor(
    private notificationService: NotificationService,
    private authenticationService: AuthenticationService,
    private confirmationModal: ConfirmationModalService,
    private alerts: AlertService,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef,
    private elementRef: ElementRef<HTMLElement>,
    private notificationOpener: NotificationOpenService,
  ) {}

  /**
   * Whether the mark all read button has anything to do.
   *
   * Worked out from the rows this page is holding, and deliberately not from
   * NotificationService.unreadCount$. That subject seeds at zero and is updated
   * independently by the bell. Reading it here would make a page action depend
   * on whether another component's refresh has completed rather than on the rows
   * the action will actually change.
   *
   * A getter rather than a field kept in step by hand. It has to answer after a
   * mark all read, after a delete, after a row is opened and after a reload, and
   * a boolean that four call sites have to remember to update is a boolean that
   * will eventually be wrong. Nothing is allocated, so unlike the visible slice
   * this is safe to recompute on every change detection pass.
   */
  get hasUnread(): boolean {
    return this.notifications.some((notification) => !notification.isRead);
  }

  /**
   * Wait for authentication before asking the api for anything.
   *
   * The route has no guard, so this component is built for whoever opens the
   * url, signed in or not. An anonymous GET /notifications comes back 403, and
   * HttpErrorInterceptor reads a 403 on an anonymous user as an expired
   * session: it shows "Authentication timed out" and redirects to /timeout,
   * instead of the sign in page somebody following a stale bookmark should get.
   *
   * afterAuthCall is what EditProfileComponent does for the same reason, and it
   * waits rather than guessing, so a page opened while the session is still
   * being restored still loads.
   */
  ngOnInit(): void {
    this.authenticationService.afterAuthCall((signedIn) => {
      if (!signedIn) {
        this.router.navigateByUrl('/sign_in');
        return;
      }

      this.load();
    });
  }

  ngOnDestroy(): void {
    this.listSubscription?.unsubscribe();
  }

  /**
   * Read every notification, once.
   *
   * Also the retry. A failed load is the one state on this page with nothing
   * useful on it, so the way out has to be on the page rather than a refresh of
   * the browser.
   */
  load(): void {
    this.loading = true;
    this.loadFailed = false;

    this.listSubscription?.unsubscribe();

    this.listSubscription = this.notificationService.list().subscribe({
      next: (notifications) => {
        this.notifications = [...notifications].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        );

        // A retry after a run of deletes can leave the reader stranded on a
        // page that no longer exists, staring at nothing.
        this.pageIndex = Math.min(this.pageIndex, this.lastPageIndex());
        this.loading = false;
        this.updateVisible();
      },
      error: () => {
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  onPage(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updateVisible();
  }

  /**
   * Open one notification: mark it read, then go where it points.
   *
   * The same shape as the dropdown in the header. They are on separate branches
   * so neither can call the other today, and once both have merged this belongs
   * in one place.
   */
  open(notification: Notification): void {
    if (!notification.isRead) {
      // A read that went out before this click is out of date now, and
      // NotificationService writes list responses into the shared entity cache,
      // so one landing late would put readAt back to null.
      this.cancelPendingList();

      this.notificationService.markRead(notification).subscribe({
        error: () => this.alerts.error('That notification could not be marked as read'),
      });
    }

    // Where it goes, for a student or for staff, and what happens when the
    // thing it was about has gone, is all decided in NotificationOpenService.
    void this.notificationOpener.open(notification);
  }

  /**
   * Mark the lot as read.
   *
   * Every one of them and not only the page on screen. read_all is the endpoint
   * and it takes no arguments, and a button labelled "mark all read" that left
   * pages two onwards unread would be lying about what it did.
   *
   * No confirmation. Nothing is lost by it and every notification is still here
   * to read afterwards, so a dialog would only be a step to click through.
   * Delete is the one that asks.
   *
   * The rows redraw without anything here touching them. NotificationService
   * writes readAt onto the entities in its cache, and the rows this page is
   * holding came out of that same cache, so they are the same objects. Setting
   * readAt again here would be a second copy of that arithmetic that could only
   * ever come to disagree with it.
   */
  markAllRead(): void {
    if (!this.hasUnread || this.markAllReadPending || this.deleteAllPending) {
      return;
    }

    this.markAllReadPending = true;

    // A list read raised before this is out of date now, and its response goes
    // straight into the shared cache, so landing late would draw every row
    // unread again.
    this.cancelPendingList();

    this.notificationService.markAllRead().subscribe({
      next: () => {
        this.markAllReadPending = false;
        this.alerts.success('All notifications marked as read');
      },
      error: () => {
        this.markAllReadPending = false;
        this.alerts.error('Your notifications could not be marked as read');
      },
    });
  }

  /**
   * Ask first, then delete.
   *
   * Delete is the only one of the five endpoints that destroys anything and
   * there is no undo anywhere in this feature, so it gets the dialog the house
   * already has rather than a new one.
   *
   * The empty cancel function is deliberate. ConfirmationModalService pops a
   * green success snackbar reading "<title> action cancelled" when none is
   * given, and telling somebody they successfully did not delete something is
   * noise.
   */
  confirmDelete(notification: Notification): void {
    if (this.isDeleting(notification) || this.deleteAllPending) {
      return;
    }

    this.confirmationModal.show(
      'Delete notification',
      `Delete "${notification.message}"? This removes the notification permanently.`,
      () => this.remove(notification),
      () => undefined,
      'Delete',
    );
  }

  /**
   * Confirm one bounded bulk delete.
   *
   * The count and highest id come from the same loaded snapshot. The API uses
   * the id as an inclusive boundary, so a notification arriving while the
   * confirmation is open is not silently deleted.
   */
  confirmDeleteAll(): void {
    if (!this.notifications.length || this.deleteAllPending) {
      return;
    }

    const throughId = Math.max(...this.notifications.map((notification) => notification.id));
    const affectedCount = this.notifications.filter(
      (notification) => notification.id <= throughId,
    ).length;
    const noun = affectedCount === 1 ? 'notification' : 'notifications';

    this.confirmationModal.show(
      'Delete all notifications',
      `Delete all ${affectedCount} ${noun}? This cannot be undone. New notifications that arrive after this confirmation will be kept.`,
      () => this.removeAll(throughId),
      () => undefined,
      'Delete all',
    );
  }

  iconFor(notification: Notification): string {
    return presentationFor(notification).icon;
  }

  toneFor(notification: Notification): string {
    return presentationFor(notification).tone;
  }

  labelFor(notification: Notification): string {
    return presentationFor(notification).label;
  }

  /**
   * What a screen reader should read for a row.
   *
   * Unread is drawn as bold text, and that is a thing you have to be able to
   * see. The message and the time are already in the button, so this only
   * exists to put the state into words.
   */
  rowLabel(notification: Notification): string {
    const state = notification.isRead ? 'Read' : 'Unread';

    return `${state}. ${this.labelFor(notification)}. ${notification.message}. ${this.timeAgo(notification)}`;
  }

  /**
   * What a screen reader should call a delete button.
   *
   * The message and not a bare "Delete notification". A page of twenty rows has
   * twenty of these buttons, and identical labels leave somebody tabbing through
   * them hearing the same three words over and over with nothing to tell them
   * apart. The dropdown gets away with the generic wording because it shows five
   * rows at most and the delete sits beside the row you just heard.
   */
  deleteLabel(notification: Notification): string {
    return `Delete: ${notification.message}`;
  }

  isDeleting(notification: Notification): boolean {
    return this.deleteAllPending || this.deletingNotificationIds.has(notification.id);
  }

  timeAgo(notification: Notification): string {
    return moment(notification.createdAt).fromNow();
  }

  /**
   * Retire a list request that is still in the air.
   *
   * Anything changed from this page is newer than a read that went out before
   * it. NotificationService writes list responses into the shared cache, so one
   * arriving late does not merely show stale rows, it undoes the change.
   *
   * loading is cleared with it. A reload that has been abandoned is not still
   * loading, and leaving the flag set would sit a spinner over the list nobody
   * is going to replace now.
   */
  private cancelPendingList(): void {
    this.listSubscription?.unsubscribe();
    this.listSubscription = null;
    this.loading = false;
  }

  /**
   * Delete it for real, once the dialog has been agreed to.
   *
   * The row is dropped from the held list on success rather than by reading the
   * list again. A second GET for something already known would leave the row on
   * screen for a round trip after the user asked for it to go.
   *
   * On failure the row stays exactly where it is. Removing it first and putting
   * it back would read as the delete having worked and then being undone by
   * something, which is a worse story than it not having worked.
   */
  private remove(notification: Notification): void {
    if (this.isDeleting(notification)) {
      return;
    }

    this.deletingNotificationIds.add(notification.id);
    this.cancelPendingList();

    const visibleIndex = this.visible.indexOf(notification);

    this.notificationService.remove(notification).subscribe({
      next: () => {
        this.deletingNotificationIds.delete(notification.id);
        this.notifications = this.notifications.filter((row) => row !== notification);

        // Deleting the only row on the last page leaves the reader on a page
        // that no longer exists, staring at nothing while the paginator insists
        // there are three of them. Same clamp as a reload does.
        this.pageIndex = Math.min(this.pageIndex, this.lastPageIndex());
        this.updateVisible();
        this.alerts.success('Notification deleted');
        this.changeDetectorRef.detectChanges();
        this.restoreFocusAfterDelete(visibleIndex);
      },
      error: () => {
        this.deletingNotificationIds.delete(notification.id);
        this.alerts.error('That notification could not be deleted');
      },
    });
  }

  private removeAll(throughId: number): void {
    if (this.deleteAllPending || !this.notifications.length) {
      return;
    }

    this.deleteAllPending = true;
    this.cancelPendingList();

    this.notificationService.deleteAll(throughId).subscribe({
      next: (deletedCount) => {
        this.deleteAllPending = false;
        this.notifications = this.notifications.filter(
          (notification) => notification.id > throughId,
        );
        this.pageIndex = Math.min(this.pageIndex, this.lastPageIndex());
        this.updateVisible();

        const message =
          deletedCount === 1 ? '1 notification deleted' : `${deletedCount} notifications deleted`;
        this.alerts.success(message);
        this.changeDetectorRef.detectChanges();
        this.restoreFocusAfterDelete(0);
      },
      error: () => {
        this.deleteAllPending = false;
        this.alerts.error('Your notifications could not be deleted');
      },
    });
  }

  private restoreFocusAfterDelete(previousIndex: number): void {
    if (document.activeElement !== document.body) {
      return;
    }

    const rows = Array.from(
      this.elementRef.nativeElement.querySelectorAll<HTMLElement>('.notification-row'),
    );
    const nextIndex = Math.min(Math.max(previousIndex, 0), rows.length - 1);

    if (rows[nextIndex]) {
      rows[nextIndex].focus();
      return;
    }

    this.elementRef.nativeElement.querySelector<HTMLElement>('.notifications-placeholder')?.focus();
  }

  private updateVisible(): void {
    const start = this.pageIndex * this.pageSize;
    this.visible = this.notifications.slice(start, start + this.pageSize);
  }

  private lastPageIndex(): number {
    return Math.max(0, Math.ceil(this.notifications.length / this.pageSize) - 1);
  }
}
