import {inject, isDevMode} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree} from '@angular/router';
import {Observable, filter, map, of, take} from 'rxjs';
import {AuthenticationService, UserService} from 'src/app/api/models/doubtfire-model';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';

export const roleWhitelistGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
): Observable<boolean | UrlTree> => {
  const authenticationService = inject(AuthenticationService);
  const globalState = inject(GlobalStateService);
  const router = inject(Router);
  const userService = inject(UserService);
  const roleWhitelist = route.data['roleWhitelist'] as string[] | undefined;

  if (!roleWhitelist?.length) {
    // A route that asks for the guard and gives it no whitelist lets everybody through. Keep
    // letting them through so production behaviour does not change, but say so while developing.
    if (isDevMode()) {
      console.error(
        `roleWhitelistGuard is on route '${routePath(route)}' with no roleWhitelist in its data, ` +
          'so it allows every signed in user. Add a roleWhitelist or drop the guard.',
      );
    }
    return of(true);
  }

  return globalState.isLoadingSubject.pipe(
    filter((isLoading) => !isLoading),
    take(1),
    map(() => {
      const role = roleForRoute(route, userService, globalState);
      return authenticationService.isAuthorised(roleWhitelist, role)
        ? true
        : router.createUrlTree(['/unauthorised']);
    }),
  );
};

function routePath(route: ActivatedRouteSnapshot): string {
  return (
    route.pathFromRoot
      .map((snapshot) => snapshot.routeConfig?.path)
      .filter((path) => !!path)
      .join('/') || '/'
  );
}

function roleForRoute(
  route: ActivatedRouteSnapshot,
  userService: UserService,
  globalState: GlobalStateService,
): string | undefined {
  const unitId = Number(route.paramMap.get('unitId') ?? route.parent?.paramMap.get('unitId'));

  if (!Number.isNaN(unitId) && unitId > 0) {
    const unitRole = globalState.loadedUnitRoles.currentValues.find(
      (role) => role.unit?.id === unitId,
    );

    if (unitRole) {
      return unitRole.role;
    }

    if (userService.currentUser.role === 'Admin' || userService.currentUser.role === 'Auditor') {
      return userService.currentUser.role;
    }

    return undefined;
  }

  return userService.currentUser.role;
}
