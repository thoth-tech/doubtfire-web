// MN-C03: receive Angular service-worker clicks in an already-open client.
import {DOCUMENT} from '@angular/common';
import {Inject, Injectable} from '@angular/core';
import {SwPush} from '@angular/service-worker';
import {Subscription} from 'rxjs';
import {NotificationRouteService} from './notification-route.service';

interface NotificationClickData {
  notification_id?: unknown;
  link?: unknown;
}

@Injectable({providedIn: 'root'})
export class PushNotificationClickService {
  private static readonly DUPLICATE_WINDOW_MS = 2000;

  private clickSubscription: Subscription | null = null;
  private lastClickKey: string | null = null;
  private lastClickAt = 0;

  constructor(
    private swPush: SwPush,
    private notificationRoutes: NotificationRouteService,
    @Inject(DOCUMENT) private appDocument: Document,
  ) {}

  public start(): void {
    if (this.clickSubscription) {
      return;
    }

    this.clickSubscription = this.swPush.notificationClicks.subscribe((event) => {
      // Angular focuses the most recently focused client before broadcasting the
      // click. Only that focused document should navigate when several tabs exist.
      if (!this.appDocument.hasFocus()) {
        return;
      }

      const data = event.notification.data as NotificationClickData | null | undefined;
      const target = this.notificationRoutes.resolve(data?.link);
      const clickKey = `${this.normalisedId(data?.notification_id)}:${target}`;
      const now = Date.now();

      if (
        clickKey === this.lastClickKey &&
        now - this.lastClickAt < PushNotificationClickService.DUPLICATE_WINDOW_MS
      ) {
        return;
      }

      this.lastClickKey = clickKey;
      this.lastClickAt = now;
      void this.notificationRoutes.navigate(target);
    });
  }

  public stop(): void {
    this.clickSubscription?.unsubscribe();
    this.clickSubscription = null;
    this.lastClickKey = null;
    this.lastClickAt = 0;
  }

  private normalisedId(value: unknown): string {
    return typeof value === 'number' || typeof value === 'string' ? String(value) : 'no-id';
  }
}
