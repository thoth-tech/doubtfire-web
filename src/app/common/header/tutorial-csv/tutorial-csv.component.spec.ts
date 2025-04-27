import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TutorialCsvComponent } from './tutorial-csv.component';

describe('TutorialCsvComponent', () => {
  let component: TutorialCsvComponent;
  let fixture: ComponentFixture<TutorialCsvComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TutorialCsvComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TutorialCsvComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
