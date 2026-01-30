import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UIRouterModule } from '@uirouter/angular';

import { UnitsIndexStateComponent } from './index.component';
import { unitsIndexState } from './index.state';

@NgModule({
  declarations: [UnitsIndexStateComponent],
  imports: [
    CommonModule,
    UIRouterModule.forChild({ states: [unitsIndexState] }),
  ],
})
export class UnitsIndexStateModule {}
