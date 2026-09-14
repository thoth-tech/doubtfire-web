import {beforeEach, describe, expect, it} from 'vitest';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatCheckboxHarness} from '@angular/material/checkbox/testing';
import {RouterModule} from '@angular/router';
import {User} from 'src/app/api/models/user/user';
import {NotificationSettingsComponent} from './notification-settings.component';

const makeUser = (): User =>
  ({
    id: 1,
    systemRole: 'Student',
    receiveTaskNotifications: false,
    receiveFeedbackNotifications: false,
    receivePortfolioNotifications: false,
  }) as User;

describe('NotificationSettingsComponent', () => {
  let component: NotificationSettingsComponent;
  let fixture: ComponentFixture<NotificationSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NotificationSettingsComponent],
      imports: [FormsModule, MatCheckboxModule, RouterModule.forRoot([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationSettingsComponent);
    component = fixture.componentInstance;
    component.user = makeUser();

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the three notification preferences', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const checkboxes = await loader.getAllHarnesses(MatCheckboxHarness);

    expect(checkboxes.length).toBe(3);

    expect(await checkboxes[0].getLabelText()).toBe('Task notifications');
    expect(await checkboxes[1].getLabelText()).toBe('Feedback notifications');
    expect(await checkboxes[2].getLabelText()).toBe('Portfolio notifications');
  });

  it('updates the correct user preference when toggled', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);

    const taskCheckbox = await loader.getHarness(
      MatCheckboxHarness.with({label: 'Task notifications'}),
    );
    const feedbackCheckbox = await loader.getHarness(
      MatCheckboxHarness.with({label: 'Feedback notifications'}),
    );
    const portfolioCheckbox = await loader.getHarness(
      MatCheckboxHarness.with({label: 'Portfolio notifications'}),
    );

    await taskCheckbox.check();

    expect(component.user.receiveTaskNotifications).toBe(true);
    expect(component.user.receiveFeedbackNotifications).toBe(false);
    expect(component.user.receivePortfolioNotifications).toBe(false);

    await feedbackCheckbox.check();

    expect(component.user.receiveFeedbackNotifications).toBe(true);

    await portfolioCheckbox.check();

    expect(component.user.receivePortfolioNotifications).toBe(true);
  });

  it('shows help text for each notification category', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Receive notifications for task-related events.');
    expect(text).toContain('Receive notifications for feedback-related events.');
    expect(text).toContain('Receive notifications for portfolio-related events.');
  });

  it('associates each checkbox with its help text', () => {
    const inputs = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    const descriptions = fixture.nativeElement.querySelectorAll('.notification-setting small');
    const descriptionIds = [
      'task-notification-description',
      'feedback-notification-description',
      'portfolio-notification-description',
    ];

    expect(inputs.length).toBe(3);
    expect(descriptions.length).toBe(3);

    descriptionIds.forEach((id, index) => {
      expect(descriptions[index].id).toBe(id);
      expect(inputs[index].getAttribute('aria-describedby')).toBe(id);
      expect(inputs[index].hasAttribute('name')).toBe(false);
    });
  });

  it('links the notification preferences to the notifications page', () => {
    fixture.componentRef.setInput('showNotificationsLink', true);
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a[href="/notifications"]');

    expect(link).not.toBeNull();
    expect(link.textContent.trim()).toBe('Notifications page');
  });

  // The admin Users dialog and the first-login form render these settings too,
  // and neither should link to the viewer's own notifications.
  it('leaves the notifications page link out unless asked to show it', () => {
    expect(fixture.nativeElement.querySelector('a[href="/notifications"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Notifications page');
  });
});
