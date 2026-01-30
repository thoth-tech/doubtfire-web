import { StateDeclaration } from '@uirouter/core';
import { UnitsIndexStateComponent } from './index.component';

export const unitsIndexState: StateDeclaration = {
  name: 'units.index',
  url: '/units/:unitId',
  abstract: true,
  component: UnitsIndexStateComponent,
  data: {
    pageTitle: '_Home_',
    roleWhitelist: ['Student', 'Tutor', 'Convenor', 'Admin', 'Auditor'],
  },
} as any;
