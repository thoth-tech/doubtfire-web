import {describe, expect, it} from 'vitest';
import {Notification} from 'src/app/api/models/notification';
import {NotificationTarget, notificationTarget} from './notification-target';

const STUDENT = {id: 50};
const TUTOR = {id: 7};

const UNIT = 3;
const PROJECT = 9;
const ABBR = '2.2C';

function notification(fields: Partial<Notification>): Notification {
  return Object.assign(new Notification(), fields);
}

// What the api sends for a notification about a task on the student's project.
function taskEvent(
  event: string,
  notificationType: string,
  feedback = false,
  extra: Partial<Notification> = {},
): Notification {
  return notification({
    event,
    notificationType,
    link: `/projects/${PROJECT}/dashboard/${ABBR}${feedback ? '/feedback' : ''}`,
    unitId: UNIT,
    projectId: PROJECT,
    studentId: STUDENT.id,
    taskDefinitionId: 21,
    taskDefinitionAbbr: ABBR,
    taskId: 400,
    commentId: null,
    groupId: null,
    ...extra,
  });
}

function projectEvent(event: string, notificationType: string, path: string): Notification {
  return notification({
    event,
    notificationType,
    link: `/projects/${PROJECT}/${path}`,
    unitId: UNIT,
    projectId: PROJECT,
    studentId: STUDENT.id,
    taskDefinitionId: null,
    taskDefinitionAbbr: null,
    taskId: null,
    commentId: null,
    groupId: null,
  });
}

const studentRoute = (...rest: (string | number)[]): NotificationTarget => ({
  kind: 'route',
  audience: 'student',
  commands: ['/projects', PROJECT, ...rest],
});

const staffInbox: NotificationTarget = {
  kind: 'route',
  audience: 'staff',
  commands: ['/units', UNIT, 'tasks', 'inbox', STUDENT.id, ABBR],
  queryParams: {students: 'all'},
};

describe('notificationTarget for a student', () => {
  it.each([
    ['task_comment_created', 'feedback', true, studentRoute('dashboard', ABBR, 'feedback')],
    ['discussion_request_created', 'feedback', true, studentRoute('dashboard', ABBR, 'feedback')],
    ['extension_assessed', 'extension', false, studentRoute('dashboard', ABBR, 'feedback')],
    ['task_status_changed', 'task', false, studentRoute('dashboard', ABBR)],
    ['new_task_available', 'task', false, studentRoute('dashboard', ABBR)],
    ['task_due_date_changed', 'task', false, studentRoute('dashboard', ABBR)],
    ['task_due_soon', 'task', false, studentRoute('dashboard', ABBR)],
  ])('%s opens the task', (event, type, feedback, expected) => {
    expect(notificationTarget(taskEvent(event, type, feedback), STUDENT)).toEqual(expected);
  });

  it('opens a new task that has no task row yet from its definition', () => {
    const target = notificationTarget(
      taskEvent('new_task_available', 'task', false, {taskId: null}),
      STUDENT,
    );

    expect(target).toEqual(studentRoute('dashboard', ABBR));
  });

  it.each([
    ['group_membership_changed', 'general', 'groups', studentRoute('groups')],
    ['portfolio_received', 'portfolio', 'dashboard', studentRoute('portfolio')],
    ['tutorial_changed', 'general', 'dashboard', studentRoute('tutorials')],
  ])('%s opens the project page for it', (event, type, path, expected) => {
    expect(notificationTarget(projectEvent(event, type, path), STUDENT)).toEqual(expected);
  });

  it('sends an unknown project event to the dashboard', () => {
    expect(
      notificationTarget(projectEvent('future_event', 'general', 'dashboard'), STUDENT),
    ).toEqual(studentRoute('dashboard'));
  });
});

describe('notificationTarget for staff', () => {
  it.each([
    ['task_submitted', 'task', false],
    ['task_help_requested', 'task', false],
    ['task_comment_created', 'feedback', true],
    ['extension_requested', 'task', false],
    ['discussion_request_created', 'feedback', true],
  ])('%s opens the student task in the inbox with its comments', (event, type, feedback) => {
    expect(notificationTarget(taskEvent(event, type, feedback), TUTOR)).toEqual(staffInbox);
  });

  it('opens a submitted portfolio in the staff portfolio view', () => {
    expect(
      notificationTarget(projectEvent('portfolio_submitted', 'portfolio', 'dashboard'), TUTOR),
    ).toEqual({
      kind: 'route',
      audience: 'staff',
      commands: ['/units', UNIT, 'students', 'portfolios', PROJECT],
    });
  });

  it('sends an unknown staff event with no task to the student list', () => {
    expect(notificationTarget(projectEvent('future_event', 'general', 'dashboard'), TUTOR)).toEqual(
      {kind: 'route', audience: 'staff', commands: ['/units', UNIT, 'students']},
    );
  });
});

describe('notificationTarget when there is nothing to open', () => {
  it('reports a deleted task as unavailable', () => {
    const deleted = taskEvent('task_comment_created', 'feedback', true, {
      taskDefinitionId: null,
      taskDefinitionAbbr: null,
      taskId: null,
    });

    expect(notificationTarget(deleted, STUDENT)).toEqual({kind: 'unavailable'});
    expect(notificationTarget(deleted, TUTOR)).toEqual({kind: 'unavailable'});
  });

  it('reports a deleted project as unavailable', () => {
    const deleted = notification({
      event: 'group_membership_changed',
      notificationType: 'general',
      link: `/projects/${PROJECT}/groups`,
      unitId: null,
      projectId: null,
      studentId: null,
      taskDefinitionAbbr: null,
    });

    expect(notificationTarget(deleted, STUDENT)).toEqual({kind: 'unavailable'});
  });

  it('has nowhere to go for a notification that never had a page', () => {
    const general = notification({event: 'general_event', notificationType: 'general', link: null});
    general.projectId = null;

    expect(notificationTarget(general, STUDENT)).toEqual({kind: 'none'});
  });

  it('follows the link from an older api that sends no ids', () => {
    const legacy = notification({
      event: 'task_comment_created',
      notificationType: 'feedback',
      link: `/projects/${PROJECT}/dashboard/${ABBR}/feedback`,
    });

    expect(notificationTarget(legacy, TUTOR)).toEqual({
      kind: 'link',
      link: `/projects/${PROJECT}/dashboard/${ABBR}/feedback`,
    });
    expect(notificationTarget(notification({event: 'x', link: null}), TUTOR)).toEqual({
      kind: 'none',
    });
  });
});

describe('notificationTarget for Unit Hub updates', () => {
  function hubEvent(event: string, extra: Partial<Notification> = {}): Notification {
    return notification({
      event,
      notificationType: 'unit_hub',
      link: '/unit-hub?unit=3&announcement=12',
      unitId: UNIT,
      projectId: null,
      studentId: null,
      taskDefinitionAbbr: null,
      announcementId: null,
      sessionId: null,
      ...extra,
    });
  }

  it.each(['unit_announcement_published', 'unit_announcement_updated'])(
    '%s opens the hub on that announcement for students and staff',
    (event) => {
      const expected: NotificationTarget = {
        kind: 'route',
        audience: 'member',
        commands: ['/unit-hub'],
        queryParams: {unit: UNIT, announcement: 12},
      };

      expect(notificationTarget(hubEvent(event, {announcementId: 12}), STUDENT)).toEqual(expected);
      expect(notificationTarget(hubEvent(event, {announcementId: 12}), TUTOR)).toEqual(expected);
    },
  );

  it.each(['unit_session_changed', 'unit_session_starting_soon'])(
    '%s opens the hub on that session',
    (event) => {
      expect(notificationTarget(hubEvent(event, {sessionId: 40}), STUDENT)).toEqual({
        kind: 'route',
        audience: 'member',
        commands: ['/unit-hub'],
        queryParams: {unit: UNIT, session: 40},
      });
    },
  );

  it('reports a deleted announcement or session as unavailable', () => {
    expect(
      notificationTarget(hubEvent('unit_announcement_published', {unitId: null}), STUDENT),
    ).toEqual({kind: 'unavailable'});
    expect(notificationTarget(hubEvent('unit_session_changed', {unitId: null}), STUDENT)).toEqual({
      kind: 'unavailable',
    });
  });

  it('opens the hub on the unit for a Unit Hub event it does not know yet', () => {
    expect(notificationTarget(hubEvent('unit_hub_future_event'), STUDENT)).toEqual({
      kind: 'route',
      audience: 'member',
      commands: ['/unit-hub'],
      queryParams: {unit: UNIT},
    });
  });

  it('follows the link from an api that sends no Unit Hub ids', () => {
    const legacy = notification({
      event: 'unit_announcement_published',
      notificationType: 'unit_hub',
      link: '/unit-hub?unit=3&announcement=12',
    });

    expect(notificationTarget(legacy, STUDENT)).toEqual({
      kind: 'link',
      link: '/unit-hub?unit=3&announcement=12',
    });
  });
});
