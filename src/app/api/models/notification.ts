import {Entity} from 'ngx-entity-service';

/**
 * Something that happened which the signed in user should be told about.
 *
 * `notificationType` is the category the user's preferences switch on, one of
 * task, feedback, portfolio, extension, general or unit_hub. The api gates
 * delivery on task, feedback, portfolio and unit_hub against the
 * receive_*_notifications columns, so the web app never has to check a
 * preference before rendering one of these.
 *
 * `event` is the stable, specific hook (for example `task_comment_created`).
 * Presentation can vary by event without inferring meaning from message text.
 */
export class Notification extends Entity {
  id: number;
  notificationType: string;
  event: string;
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
   * The ids of the page this is about, sent beside link by newer apis.
   *
   * Left undefined when the api did not send them at all, which is how an older
   * api is told apart from a newer one saying the record is gone (null). Do not
   * give these a default, or that difference is lost.
   */
  unitId?: number | null;
  projectId?: number | null;
  studentId?: number | null;
  taskDefinitionId?: number | null;
  taskDefinitionAbbr?: string | null;
  taskId?: number | null;
  commentId?: number | null;
  groupId?: number | null;

  /**
   * The Unit Hub announcement or session a unit_hub notification is about.
   * Null once it has been deleted, undefined from an api that predates them.
   */
  announcementId?: number | null;
  sessionId?: number | null;

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
