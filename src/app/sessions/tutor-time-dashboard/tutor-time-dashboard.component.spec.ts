import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TutorTimeDashboardComponent } from './tutor-time-dashboard.component';

describe('TutorTimeDashboardComponent', () => {
  let component: TutorTimeDashboardComponent;
  let fixture: ComponentFixture<TutorTimeDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TutorTimeDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TutorTimeDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
