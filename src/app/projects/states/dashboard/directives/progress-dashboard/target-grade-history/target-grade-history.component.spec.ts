import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TargetGradeHistoryComponent } from './target-grade-history.component';

describe('TargetGradeHistoryComponent', () => {
  let component: TargetGradeHistoryComponent;
  let fixture: ComponentFixture<TargetGradeHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TargetGradeHistoryComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TargetGradeHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
