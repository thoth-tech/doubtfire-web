import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { StarRatingComponent } from './star-rating.component';

describe('StarRatingComponent', () => {
  let component: StarRatingComponent;
  let fixture: ComponentFixture<StarRatingComponent>;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [StarRatingComponent],
      }).compileComponents();
    })
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(StarRatingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should create the correct amount of stars', () => {
    component.totalStars = 10;
    component.ngOnInit();

    expect(component.stars.length).toEqual(10);
  });

  it('should set the correct class based on the selected rating', () => {
    component.totalStars = 10;
    component.selectedRating = 5;
    component.ngOnInit();

    component.stars.forEach((star, index) => {
      expect(star.class).toEqual('star star-hover ' + (index < 5 ? 'star-gold' : 'star-silver'));
    })
  });

  it('should emit a new selected rating', async() => {
    component.totalStars = 10;
    component.ngOnInit();
    component.newSelectedRating.subscribe(newRating => {
      expect(newRating).toEqual(5);
    });
    component.selectStar(5);
  });

  it('should allow a rating to be changed', () => {
    component.totalStars = 10;
    component.selectedRating = 5;
    component.ngOnInit();

    expect(component.selectedRating).toEqual(5);
    component.selectedRating = 7;
    expect(component.selectedRating).toEqual(7);
  });

});
