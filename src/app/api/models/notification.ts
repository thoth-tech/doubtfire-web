import {Entity} from 'ngx-entity-service';

/**
 * Something that happened which the signed in user should be told about.
 *
 * `notificationType` is the category the user's preferences switch on, one of
 * task, feedback, portfolio, extension or general. The api gates delivery on
 * the first three against the receive_*_notifications columns, so the web app
 * never has to check a preference before rendering one of these.
 *
 * The api also records an `event` naming the specific thing that happened, but
 * NotificationEntity does not expose it, so it is deliberately absent here.
 */
export class Notification extends Entity {
  id: number;
  notificationType: string;
  message: string;

  /**
   * Where to send the user when they click this, or null when there is nowhere
   * to go. Treat it as a route within the app, not an absolute url.
   *
   * The column is nullable on the api, so guard it before calling anything on
   * it. The union is documentation for now, the repo builds with strict off.
   */
  link: string | null;

  /**
   * When the user read this, or null while it is still unread.
   */
  readAt: Date | null;

  /**
   * Never null. The api column is NOT NULL, which is why this one can go
   * through the plain date mapping and readAt cannot.
   */
  createdAt: Date;

  public get isRead(): boolean {
    return this.readAt != null;
  }
}
