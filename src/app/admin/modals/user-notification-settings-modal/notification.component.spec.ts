import { ComponentFixture, TestBed } from '@angular/core/testing';

import { notificationComponent } from './notification.component';

describe('notificationComponent', () => {
  let component: notificationComponent;
  let fixture: ComponentFixture<notificationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [notificationComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(notificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
