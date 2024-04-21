import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CourseMapComponent } from './pages/course-map/course-map.component';
import { CourseListComponent } from './components/course-list/course-list.component';
import { UnitListComponent } from './components/unit-list/unit-list.component';
import { CourseDetailsSidebarComponent } from './components/course-details-sidebar/course-details-sidebar.component';

@NgModule({
  declarations: [
    AppComponent,
    CourseMapComponent,
    CourseListComponent,
    UnitListComponent,
    CourseDetailsSidebarComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }