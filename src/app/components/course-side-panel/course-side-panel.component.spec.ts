import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourseSidePanelComponent } from './course-side-panel.component';

describe('CourseSidePanelComponent', () => {
  let component: CourseSidePanelComponent;
  let fixture: ComponentFixture<CourseSidePanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseSidePanelComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CourseSidePanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
