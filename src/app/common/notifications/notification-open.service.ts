import {Injectable} from '@angular/core';
import {Router} from '@angular/router';
import {filter, firstValueFrom, take} from 'rxjs';
import {Notification} from 'src/app/api/models/notification';
import {NotificationRouteService} from 'src/app/api/services/notification-route.service';
import {UserService} from 'src/app/api/services/user.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {notificationTarget} from './notification-target';

export const NOTIFICATION_UNAVAILABLE_MESSAGE = 'That item is no longer available';

/**
 * Open the page a notification is about, from the bell or the full page.
 *
 * notificationTarget decides where. This does the parts that need the running
 * app: whether a member of staff still has a role in that unit, the navigation
 * itself, and the snackbar when either says no. The reader always stays where
 * they are in that case, never on a blank page or on /unauthorised.
 */
@Injectable({providedIn: 'root'})
export class NotificationOpenService {
  constructor(
    private router: Router,
    private routes: NotificationRouteService,
    private users: UserService,
    private globalState: GlobalStateService,
    private alerts: AlertService,
  ) {}

  async open(notification: Notification): Promise<boolean> {
    const target = notificationTarget(notification, this.users.currentUser);

    switch (target.kind) {
      case 'none':
        return false;
      case 'link':
        return this.routes.navigate(target.link);
      case 'unavailable':
        return this.unavailable();
    }

    if (target.audience === 'staff' && !(await this.canViewUnit(Number(target.commands[1])))) {
      return this.unavailable();
    }

    const url = this.router.serializeUrl(
      this.router.createUrlTree(target.commands, {queryParams: target.queryParams}),
    );

    try {
      const navigated = await this.routes.navigateToTarget(url);
      if (!navigated && !this.router.url.startsWith(url)) {
        return this.unavailable();
      }
      return navigated;
    } catch {
      return this.unavailable();
    }
  }

  /**
   * Whether the signed in user still holds a role in the unit.
   *
   * Asked before navigating because the unit routes answer a missing role by
   * redirecting to /unauthorised, which is exactly the dead end this avoids.
   * Unit roles load once after sign in, so wait for that first.
   */
  private async canViewUnit(unitId: number): Promise<boolean> {
    const role = this.users.currentUser?.role;
    if (role === 'Admin' || role === 'Auditor') {
      return true;
    }

    await firstValueFrom(
      this.globalState.isLoadingSubject.pipe(
        filter((loading) => !loading),
        take(1),
      ),
    );

    return this.globalState.loadedUnitRoles.currentValues.some(
      (unitRole) => unitRole.unit?.id === unitId,
    );
  }

  private unavailable(): false {
    this.alerts.error(NOTIFICATION_UNAVAILABLE_MESSAGE);
    return false;
  }
}
