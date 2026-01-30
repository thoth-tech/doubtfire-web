import { NgModule } from '@angular/core';


// Import all state modules
import { UnitsIndexStateModule } from './index/index.module';


// working on child components, will need to create components for the following to complete this migration
/*
import { UnitsEditStateModule } from './edit/edit.module';
import { UnitsTasksStateModule } from './tasks/tasks.module';
import { UnitsGroupsStateModule } from './groups/groups.module';
import { UnitsStudentsStateModule } from './students/students.module';
import { UnitsAnalyticsStateModule } from './analytics/analytics.module';
import { UnitsPortfoliosStateModule } from './portfolios/portfolios.module';
import { UnitsRolloverStateModule } from './rollover/rollover.module';
*/


@NgModule({
  imports: [
    UnitsIndexStateModule
    /*,
    UnitsEditStateModule,
    UnitsTasksStateModule,
    UnitsGroupsStateModule,
    UnitsStudentsStateModule,
    UnitsAnalyticsStateModule,
    UnitsPortfoliosStateModule,
    UnitsRolloverStateModule,
    */
  ],
})
export class UnitsStatesModule {}



