import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {DemoModeStore} from './demo-mode.store';

export const demoToolsGuard: CanActivateFn = () => {
  const demoMode = inject(DemoModeStore);
  return demoMode.available ? true : inject(Router).createUrlTree(['/home']);
};
