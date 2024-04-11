import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourseFlowComponent } from './course-flow.component';

describe('CourseFlowComponent', () => {
  let component: CourseFlowComponent;
  let fixture: ComponentFixture<CourseFlowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseFlowComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CourseFlowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
