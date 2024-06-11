import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourseDetailsSidebarComponent } from './course-details-sidebar.component';

describe('CourseDetailsSidebarComponent', () => {
  let component: CourseDetailsSidebarComponent;
  let fixture: ComponentFixture<CourseDetailsSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseDetailsSidebarComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CourseDetailsSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
