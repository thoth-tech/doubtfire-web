import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CourseMapComponent } from './pages/course-map/course-map.component';

const routes: Routes = [
  { path: 'course-map', component: CourseMapComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }