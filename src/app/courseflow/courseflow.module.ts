import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidePanelComponent } from './components/side-panel/side-panel.component';
import { CoreUnitsComponent } from './components/side-panel/core-units/core-units.component';
import { CreditPointsComponent } from './components/side-panel/credit-points/credit-points.component';
import { ElectiveUnitsComponent } from './components/side-panel/elective-units/elective-units.component';
import { UnitDetailOverlayComponent } from './components/unit-detail-overlay/unit-detail-overlay.component';
import { CourseMapContainerComponent } from './components/course-map-container/course-map-container.component';
import { YearContainerComponent } from './components/course-map-container/year-container/year-container.component';
import { TrimesterContainerComponent } from './components/course-map-container/trimester-container/trimester-container.component';
import { UnitSlotContainerComponent } from './components/course-map-container/unit-slot-container/unit-slot-container.component';
import { CourseflowComponent } from './courseflow.component';

@NgModule({
  declarations: [
    SidePanelComponent,
    CoreUnitsComponent,
    CreditPointsComponent,
    ElectiveUnitsComponent,
    UnitDetailOverlayComponent,
    CourseMapContainerComponent,
    YearContainerComponent,
    TrimesterContainerComponent,
    UnitSlotContainerComponent,
    CourseflowComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    SidePanelComponent,
    CourseMapContainerComponent,
    CourseflowComponent
  ]
})
export class CourseflowModule { }
