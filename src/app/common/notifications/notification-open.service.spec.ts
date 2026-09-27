import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Router} from '@angular/router';
import {BehaviorSubject} from 'rxjs';
import {Notification} from 'src/app/api/models/notification';
import {NotificationRouteService} from 'src/app/api/services/notification-route.service';
import {UserService} from 'src/app/api/services/user.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {
  NOTIFICATION_UNAVAILABLE_MESSAGE,
  NotificationOpenService,
} from './notification-open.service';

describe('NotificationOpenService', () => {
  let router: {
    url: string;
    createUrlTree: ReturnType<typeof vi.fn>;
    serializeUrl: ReturnType<typeof vi.fn>;
  };
  let routes: {navigate: ReturnType<typeof vi.fn>; navigateToTarget: ReturnType<typeof vi.fn>};
  let users: {currentUser: {id: number; role: string}};
  let loading: BehaviorSubject<boolean>;
  let unitRoles: {unit: {id: number}}[];
  let alerts: {error: ReturnType<typeof vi.fn>};
  let service: NotificationOpenService;

  function fields(overrides: Partial<Notification>): Notification {
    return Object.assign(new Notification(), {
      event: 'task_comment_created',
      notificationType: 'feedback',
      link: '/projects/9/dashboard/2.2C/feedback',
      unitId: 3,
      projectId: 9,
      studentId: 50,
      taskDefinitionAbbr: '2.2C',
      ...overrides,
    });
  }

  beforeEach(() => {
    router = {
      url: '/notifications',
      // Stands in for the real router: joins the commands and appends the query.
      createUrlTree: vi.fn((commands: (string | number)[], extras: {queryParams?: object}) => ({
        commands,
        queryParams: extras?.queryParams,
      })),
      serializeUrl: vi.fn((tree: {commands: (string | number)[]; queryParams?: object}) => {
        const path = tree.commands.join('/').replace(/^\/+/, '/');
        const query = tree.queryParams
          ? `?${new URLSearchParams(tree.queryParams as Record<string, string>).toString()}`
          : '';
        return `${path}${query}`;
      }),
    };
    routes = {
      navigate: vi.fn().mockResolvedValue(true),
      navigateToTarget: vi.fn().mockResolvedValue(true),
    };
    users = {currentUser: {id: 50, role: 'Student'}};
    loading = new BehaviorSubject(false);
    unitRoles = [];
    alerts = {error: vi.fn()};

    service = new NotificationOpenService(
      router as unknown as Router,
      routes as unknown as NotificationRouteService,
      users as unknown as UserService,
      {
        isLoadingSubject: loading,
        loadedUnitRoles: {
          get currentValues() {
            return unitRoles;
          },
        },
      } as unknown as GlobalStateService,
      alerts as unknown as AlertService,
    );
  });

  it('opens a student comment on the feedback pane', async () => {
    await expect(service.open(fields({}))).resolves.toBe(true);

    expect(routes.navigateToTarget).toHaveBeenCalledWith('/projects/9/dashboard/2.2C/feedback');
    expect(alerts.error).not.toHaveBeenCalled();
  });

  it('opens a staff notification in the inbox when the tutor teaches the unit', async () => {
    users.currentUser = {id: 7, role: 'Tutor'};
    unitRoles = [{unit: {id: 3}}];

    await expect(service.open(fields({event: 'task_submitted'}))).resolves.toBe(true);

    expect(routes.navigateToTarget).toHaveBeenCalledWith(
      '/units/3/tasks/inbox/50/2.2C?students=all',
    );
  });

  it('waits for unit roles to load before deciding', async () => {
    users.currentUser = {id: 7, role: 'Tutor'};
    loading.next(true);

    const opened = service.open(fields({event: 'task_submitted'}));
    await Promise.resolve();
    expect(routes.navigateToTarget).not.toHaveBeenCalled();

    unitRoles = [{unit: {id: 3}}];
    loading.next(false);

    await expect(opened).resolves.toBe(true);
  });

  it('stays put and says so when staff no longer have a role in the unit', async () => {
    users.currentUser = {id: 7, role: 'Tutor'};
    unitRoles = [{unit: {id: 99}}];

    await expect(service.open(fields({event: 'task_submitted'}))).resolves.toBe(false);

    expect(routes.navigateToTarget).not.toHaveBeenCalled();
    expect(alerts.error).toHaveBeenCalledWith(NOTIFICATION_UNAVAILABLE_MESSAGE);
  });

  it('lets an admin through without a unit role', async () => {
    users.currentUser = {id: 7, role: 'Admin'};

    await expect(service.open(fields({event: 'task_submitted'}))).resolves.toBe(true);
  });

  it('stays put and says so when the task was deleted', async () => {
    await expect(
      service.open(fields({taskDefinitionAbbr: null, taskDefinitionId: null})),
    ).resolves.toBe(false);

    expect(routes.navigateToTarget).not.toHaveBeenCalled();
    expect(alerts.error).toHaveBeenCalledWith(NOTIFICATION_UNAVAILABLE_MESSAGE);
  });

  it('says so when the navigation is refused', async () => {
    routes.navigateToTarget.mockResolvedValue(false);

    await expect(service.open(fields({}))).resolves.toBe(false);

    expect(alerts.error).toHaveBeenCalledWith(NOTIFICATION_UNAVAILABLE_MESSAGE);
  });

  it('says so when the navigation fails', async () => {
    routes.navigateToTarget.mockRejectedValue(new Error('resolver failed'));

    await expect(service.open(fields({}))).resolves.toBe(false);

    expect(alerts.error).toHaveBeenCalledWith(NOTIFICATION_UNAVAILABLE_MESSAGE);
  });

  it('opens a Unit Hub announcement on the hub without asking for a staff role', async () => {
    users.currentUser = {id: 7, role: 'Tutor'};
    loading.next(true);

    const notification = fields({
      event: 'unit_announcement_published',
      notificationType: 'unit_hub',
      link: '/unit-hub?unit=3&announcement=12',
      projectId: null,
      studentId: null,
      taskDefinitionAbbr: null,
      announcementId: 12,
      sessionId: null,
    });

    await expect(service.open(notification)).resolves.toBe(true);

    expect(routes.navigateToTarget).toHaveBeenCalledWith('/unit-hub?unit=3&announcement=12');
  });

  it('follows the link from an older api that sends no ids', async () => {
    const legacy = Object.assign(new Notification(), {
      event: 'task_comment_created',
      link: '/projects/9/dashboard',
    });

    await service.open(legacy);

    expect(routes.navigate).toHaveBeenCalledWith('/projects/9/dashboard');
    expect(routes.navigateToTarget).not.toHaveBeenCalled();
  });

  it('does nothing for a notification that was never about a page', async () => {
    await expect(service.open(fields({link: null, projectId: null}))).resolves.toBe(false);

    expect(routes.navigate).not.toHaveBeenCalled();
    expect(routes.navigateToTarget).not.toHaveBeenCalled();
    expect(alerts.error).not.toHaveBeenCalled();
  });
});
