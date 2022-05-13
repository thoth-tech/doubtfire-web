import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationComponent } from './notification.component';

import { MatDialogRef } from '@angular/material/dialog';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl } from '@angular/forms';
import {
  alertService,
  User,
  currentUser,
  auth,
} from 'src/app/ajs-upgraded-providers';

describe('NotificationComponent', () => {
  let component: NotificationComponent;
  let fixture: ComponentFixture<NotificationComponent>;
  let currentUserValue = {
    profile: {
      Id: 1,
      receive_feedback_notifications: true,
      receive_portfolio_notifications: true,
      receive_task_notifications: true,
    }
  };
  let formGroupValue = {
    taskSetting: false,
    feedbackSetting: false,
    portfolioSetting: false,
  };


  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NotificationComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: MatDialogRef, useValue: {} },
        FormBuilder,
        {
          provide: FormGroup, useValue: formGroupValue
        },
        FormControl,
        {
          provide: currentUser, useValue: currentUserValue
        },
        { provide: alertService, useValue: { add() { } } },
        { provide: auth, useValue: { saveCurrentUser() { } } },
        { provide: User, useValue: { update() { } } },
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NotificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should read current user notification settings when opening the dialog', () => {
    component.ngOnInit();

    expect(component.notificationSettings.value.feedbackSetting).toEqual(currentUserValue.profile.receive_feedback_notifications);
    expect(component.notificationSettings.value.taskSetting).toEqual(currentUserValue.profile.receive_task_notifications);
    expect(component.notificationSettings.value.portfolioSetting).toEqual(currentUserValue.profile.receive_portfolio_notifications);
  });

  it('should change the formGroup value when select options', () => {
    let option_true = true;
    let option_false = false;
    let settings = ['taskSetting', 'feedbackSetting', 'portfolioSetting'];

    component.ngOnInit();
    console.log(component.notificationSettings)

    for (var i = 0; i < settings.length; i++) {
      // change the corresponding value to true
      component.changeItem(settings[i], option_true);
      expect(component.notificationSettings.value[settings[i]]).toEqual(true);

      // change corresponding value to false
      component.changeItem(settings[i], option_false);
      expect(component.notificationSettings.value[settings[i]]).toEqual(false);
    }
  });

  it('should change the settings value of CurrentUser when click save button', () => {
    component.changeItem('taskSetting', formGroupValue.taskSetting);
    component.changeItem('feedbackSetting', formGroupValue.feedbackSetting);
    component.changeItem('portfolioSetting', formGroupValue.portfolioSetting);
    component.saveNotifications();

    expect(currentUserValue.profile.receive_task_notifications).toEqual(formGroupValue.taskSetting);
    expect(currentUserValue.profile.receive_feedback_notifications).toEqual(formGroupValue.feedbackSetting);
    expect(currentUserValue.profile.receive_portfolio_notifications).toEqual(formGroupValue.portfolioSetting);
  });
});
