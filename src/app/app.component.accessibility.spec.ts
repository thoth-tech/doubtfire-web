import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {Router, RouterOutlet, provideRouter} from '@angular/router';
import {PushNotificationClickService} from 'src/app/api/services/push-notification-click.service';
import {PushNotificationService} from 'src/app/api/services/push-notification.service';
import {AppComponent} from './app.component';
import {expectAccessible} from './common/testing/accessibility';
import {ThemeService} from './common/theme/theme.service';

@Component({
  selector: 'app-header',
  // eslint-disable-next-line @angular-eslint/component-max-inline-declarations -- Test-only shell collaborator.
  template: '@if (shown) { <header><a href="/home">Home</a></header> }',
  changeDetection: ChangeDetectionStrategy.Eager,
})
class ShellHeaderFixture {
  shown = true;
}

@Component({
  // eslint-disable-next-line @angular-eslint/component-max-inline-declarations -- Test-only routed content.
  template: '<h1>Student tasks</h1><p>Choose a task to submit.</p>',
})
class StudentRouteFixture {}

@Component({
  // eslint-disable-next-line @angular-eslint/component-max-inline-declarations -- Test-only routed content.
  template: '<h1>Staff inbox</h1><p>Choose a submission to review.</p>',
})
class StaffRouteFixture {}

describe('Application main landmark', () => {
  let fixture: ComponentFixture<AppComponent>;
  let previousBackground: string;

  beforeEach(async () => {
    previousBackground = document.body.style.backgroundColor;
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [RouterOutlet, ShellHeaderFixture],
      providers: [
        provideRouter([
          {path: 'student', component: StudentRouteFixture},
          {path: 'staff', component: StaffRouteFixture},
        ]),
        {provide: PushNotificationClickService, useValue: {start: vi.fn(), stop: vi.fn()}},
        {provide: PushNotificationService, useValue: {start: vi.fn(), stop: vi.fn()}},
        {provide: ThemeService, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.body.style.backgroundColor = previousBackground;
  });

  it('keeps exactly one main around routed content as the route changes', async () => {
    const router = TestBed.inject(Router);
    const element = fixture.nativeElement as HTMLElement;
    const main = element.querySelector('main');

    for (const [url, heading] of [
      ['/student', 'Student tasks'],
      ['/staff', 'Staff inbox'],
    ]) {
      await router.navigateByUrl(url);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(element.querySelectorAll('main, [role="main"]').length).toBe(1);
      expect(element.querySelector('main')).toBe(main);
      expect(main.querySelector('h1').textContent).toBe(heading);
      expect(main.contains(element.querySelector('app-header'))).toBe(false);
      expect(main.contains(element.querySelector('f-student-onboarding'))).toBe(false);
      await expectAccessible(element);
    }
  });

  it('preserves the main landmark when a route hides the header', async () => {
    await TestBed.inject(Router).navigateByUrl('/student');
    const header = fixture.debugElement.query(By.directive(ShellHeaderFixture))
      .componentInstance as ShellHeaderFixture;
    header.shown = false;
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('header')).toBeNull();
    expect(element.querySelectorAll('main, [role="main"]').length).toBe(1);
    expect(element.querySelector('main h1').textContent).toBe('Student tasks');
    await expectAccessible(element);
  });
});
