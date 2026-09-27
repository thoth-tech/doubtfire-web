import {CanDeactivateFn} from '@angular/router';

export interface CourseFlowNavigation {
  canLeave(): boolean;
}

export const courseFlowDirtyGuard: CanDeactivateFn<CourseFlowNavigation> = (component) =>
  component.canLeave();
