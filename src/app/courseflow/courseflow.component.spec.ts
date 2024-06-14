import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourseFlowComponent } from './courseflow.component';

describe('CourseFlowComponent', () => {
  let component: CourseFlowComponent;
  let fixture: ComponentFixture<CourseFlowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CourseFlowComponent ]
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
