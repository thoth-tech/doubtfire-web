import {Routes} from '@angular/router';
import {ProjectsGroupsComponent} from './groups.component';

export const PROJECTS_GROUPS_ROUTES: Routes = [
  {
    path: 'groups',
    component: ProjectsGroupsComponent,
    data: {
      task: 'Groups List',
      pageTitle: '_Home_',
      roleWhitelist: ['Tutor', 'Convenor', 'Admin', 'Student', 'Auditor'],
    },
  },
];
