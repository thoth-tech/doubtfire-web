import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {RouterLink, provideRouter} from '@angular/router';
import {Task, User} from 'src/app/api/models/doubtfire-model';
import {UserBadgeComponent} from './user-badge.component';

describe('UserBadgeComponent', () => {
  let component: UserBadgeComponent;
  let fixture: ComponentFixture<UserBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserBadgeComponent],
      imports: [RouterLink],
      providers: [provideRouter([])],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UserBadgeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the real user name when the optional display name is absent', () => {
    component.selectedTask = {
      project: {
        id: 42,
        student: Object.assign(new User(), {
          firstName: 'Demo',
          lastName: 'Student',
        }),
      },
      definition: {name: 'Demonstration task', abbreviation: '1.1P'},
    } as unknown as Task;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h4').textContent.trim()).toBe('Demo Student');
    expect(fixture.nativeElement.querySelector('h4').closest('a').getAttribute('href')).toBe(
      '/projects/42/dashboard?tutor=true',
    );
  });
});
