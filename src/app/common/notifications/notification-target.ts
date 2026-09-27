import {Params} from '@angular/router';
import {Notification} from 'src/app/api/models/notification';

/**
 * Where opening a notification should take the person reading it.
 *
 * - `route`: go to `commands` with `queryParams`. `audience` says whose page it
 *   is, so the caller can check a staff member still teaches that unit first.
 *   `member` is a page for anyone in the unit, such as the Unit Hub, which
 *   checks access itself.
 * - `link`: the api is too old to send ids, so follow its link as before.
 * - `unavailable`: the thing it was about is gone. Say so and stay put.
 * - `none`: nothing to open, for example a general announcement.
 */
export type NotificationTarget =
  | {
      kind: 'route';
      audience: 'student' | 'staff' | 'member';
      commands: (string | number)[];
      queryParams?: Params;
    }
  | {kind: 'link'; link: string}
  | {kind: 'unavailable'}
  | {kind: 'none'};

export interface NotificationViewer {
  id: number;
}

// Opens on the comments pane on a student's dashboard.
const STUDENT_COMMENT_EVENTS: ReadonlySet<string> = new Set([
  'task_comment_created',
  'discussion_request_created',
  'extension_assessed',
]);

const PORTFOLIO_EVENTS: ReadonlySet<string> = new Set([
  'portfolio_received',
  'portfolio_submitted',
]);

const UNIT_HUB_ANNOUNCEMENT_EVENTS: ReadonlySet<string> = new Set([
  'unit_announcement_published',
  'unit_announcement_updated',
]);

const UNIT_HUB_SESSION_EVENTS: ReadonlySet<string> = new Set([
  'unit_session_changed',
  'unit_session_starting_soon',
]);

/**
 * One place that decides where every notification goes, for either role.
 *
 * The role is read from the notification, not from the user's account. A
 * notification about the viewer's own project is a student one, and one about
 * somebody else's project can only have reached a member of staff. That keeps a
 * tutor who is also enrolled in another unit on the right side of both.
 */
export function notificationTarget(
  notification: Notification,
  viewer: NotificationViewer,
): NotificationTarget {
  if (notification.notificationType === 'unit_hub') {
    return unitHubTarget(notification);
  }

  const hasIds = notification.projectId !== undefined;

  if (!hasIds) {
    return notification.link ? {kind: 'link', link: notification.link} : {kind: 'none'};
  }

  if (notification.projectId == null) {
    // A link with no project behind it any more is a deleted project. No link
    // at all is a notification that was never about a page.
    return notification.link ? {kind: 'unavailable'} : {kind: 'none'};
  }

  const event = notification.event;
  const projectId = notification.projectId;
  const abbreviation = notification.taskDefinitionAbbr;
  const linkNamesTask = /\/dashboard\/[^/]+/.test(notification.link ?? '');

  // The link named a task and the api could not find it, so it was deleted.
  if (linkNamesTask && !abbreviation) {
    return {kind: 'unavailable'};
  }

  if (notification.studentId === viewer.id) {
    return studentTarget(event, notification.notificationType, projectId, abbreviation);
  }

  if (notification.unitId == null || notification.studentId == null) {
    return {kind: 'unavailable'};
  }

  return staffTarget(
    event,
    notification.notificationType,
    notification.unitId,
    projectId,
    notification.studentId,
    abbreviation,
  );
}

/**
 * A Unit Hub announcement or session opens the hub on its unit, naming the one
 * it is about in the query so the hub can open its details.
 */
function unitHubTarget(notification: Notification): NotificationTarget {
  const event = notification.event;
  const isSession = UNIT_HUB_SESSION_EVENTS.has(event);
  const isAnnouncement = UNIT_HUB_ANNOUNCEMENT_EVENTS.has(event);

  // An api that sends no ids at all sends neither of these.
  if (notification.announcementId === undefined && notification.sessionId === undefined) {
    return notification.link ? {kind: 'link', link: notification.link} : {kind: 'none'};
  }

  const id = isSession ? notification.sessionId : notification.announcementId;
  if (notification.unitId == null || ((isSession || isAnnouncement) && id == null)) {
    return {kind: 'unavailable'};
  }

  const queryParams: Params = {unit: notification.unitId};
  if (isSession) {
    queryParams.session = id;
  } else if (isAnnouncement) {
    queryParams.announcement = id;
  }

  return {kind: 'route', audience: 'member', commands: ['/unit-hub'], queryParams};
}

function studentTarget(
  event: string,
  type: string,
  projectId: number,
  abbreviation: string | null | undefined,
): NotificationTarget {
  const project = ['/projects', projectId];
  const route = (...rest: (string | number)[]): NotificationTarget => ({
    kind: 'route',
    audience: 'student',
    commands: [...project, ...rest],
  });

  if (event === 'group_membership_changed') {
    return route('groups');
  }
  if (event === 'tutorial_changed') {
    return route('tutorials');
  }
  if (PORTFOLIO_EVENTS.has(event) || (type === 'portfolio' && !abbreviation)) {
    return route('portfolio');
  }
  if (abbreviation) {
    return STUDENT_COMMENT_EVENTS.has(event)
      ? route('dashboard', abbreviation, 'feedback')
      : route('dashboard', abbreviation);
  }
  return route('dashboard');
}

function staffTarget(
  event: string,
  type: string,
  unitId: number,
  projectId: number,
  studentId: number,
  abbreviation: string | null | undefined,
): NotificationTarget {
  if (PORTFOLIO_EVENTS.has(event) || (type === 'portfolio' && !abbreviation)) {
    return {
      kind: 'route',
      audience: 'staff',
      commands: ['/units', unitId, 'students', 'portfolios', projectId],
    };
  }

  if (abbreviation) {
    // The inbox route that opens one student's task with its comments beside
    // it. 'all' so a task the unit's convenor hears about, but does not tutor,
    // is not filtered out of their list before it can be selected.
    return {
      kind: 'route',
      audience: 'staff',
      commands: ['/units', unitId, 'tasks', 'inbox', studentId, abbreviation],
      queryParams: {students: 'all'},
    };
  }

  return {kind: 'route', audience: 'staff', commands: ['/units', unitId, 'students']};
}
