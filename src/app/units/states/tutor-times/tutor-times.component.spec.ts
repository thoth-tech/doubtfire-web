import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { TutorTimesComponent } from './tutor-times.component';

describe('TutorTimesComponent', () => {
  let component: TutorTimesComponent;
  let fixture: ComponentFixture<TutorTimesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TutorTimesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TutorTimesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
