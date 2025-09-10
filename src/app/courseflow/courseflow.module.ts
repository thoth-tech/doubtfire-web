import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CourseFlowRoutingModule } from './courseflow-routing.module';
import { CourseMapStateService } from './services/course-map-state.service';
import { DegreeProgressModule } from './common/degree-progress/degree-progress.module';

@NgModule({
  imports: [
    CommonModule,
    CourseFlowRoutingModule,
    DegreeProgressModule
  ],
  providers: [CourseMapStateService]
})
export class CourseFlowModule { }