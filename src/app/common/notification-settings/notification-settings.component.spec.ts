import {beforeEach, describe, expect, it} from 'vitest';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatCheckboxHarness} from '@angular/material/checkbox/testing';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatSelectModule} from '@angular/material/select';
import {MatSelectHarness} from '@angular/material/select/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
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
    receiveUnitHubNotifications: true,
    receiveUnitHubEmailNotifications: false,
    receiveUnitHubPushNotifications: false,
    receiveUnitHubSessionReminders: false,
  }) as User;

describe('NotificationSettingsComponent', () => {
  let component: NotificationSettingsComponent;
  let fixture: ComponentFixture<NotificationSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NotificationSettingsComponent],
      imports: [
        FormsModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIconModule,
        MatSelectModule,
        NoopAnimationsModule,
        RouterModule.forRoot([]),
      ],
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

  it('shows the four notification categories and the Unit Hub channels', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const checkboxes = await loader.getAllHarnesses(MatCheckboxHarness);

    expect(await Promise.all(checkboxes.map((checkbox) => checkbox.getLabelText()))).toEqual([
      'Task notifications',
      'Feedback notifications',
      'Portfolio notifications',
      'Unit Hub updates',
      'Email',
      'Push',
      'Session reminders',
    ]);
  });

  it('renders the Unit Hub row like the other categories', () => {
    const rows: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.notification-setting:not(.notification-setting--choice)',
      ),
    );
    const hubRow = rows[3];

    expect(rows.length).toBe(4);
    expect(hubRow.querySelector('small')?.id).toBe('unit-hub-notification-description');
    expect(hubRow.textContent).toContain('New and changed announcements');
    expect(hubRow.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Also send Unit Hub updates by',
    );
  });

  it('starts Unit Hub updates in the app only, and saves each channel to its own field', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const hub = await loader.getHarness(MatCheckboxHarness.with({label: 'Unit Hub updates'}));
    const email = await loader.getHarness(MatCheckboxHarness.with({label: 'Email'}));
    const push = await loader.getHarness(MatCheckboxHarness.with({label: 'Push'}));
    const reminders = await loader.getHarness(
      MatCheckboxHarness.with({label: 'Session reminders'}),
    );

    expect(await hub.isChecked()).toBe(true);
    expect(await email.isChecked()).toBe(false);
    expect(await push.isChecked()).toBe(false);
    expect(await reminders.isChecked()).toBe(false);

    await email.check();
    await reminders.check();

    expect(component.user.receiveUnitHubEmailNotifications).toBe(true);
    expect(component.user.receiveUnitHubPushNotifications).toBe(false);
    expect(component.user.receiveUnitHubSessionReminders).toBe(true);
  });

  it('turns the Unit Hub channels off while the category is off', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const hub = await loader.getHarness(MatCheckboxHarness.with({label: 'Unit Hub updates'}));

    await hub.uncheck();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.user.receiveUnitHubNotifications).toBe(false);
    for (const label of ['Email', 'Push', 'Session reminders']) {
      const channel = await loader.getHarness(MatCheckboxHarness.with({label}));
      expect(await channel.isDisabled()).toBe(true);
    }
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

  // The profile form listens for this to enable Save profile, because these
  // standalone checkboxes never mark that form dirty themselves.
  it('reports each toggle so the enclosing form can be marked dirty', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    let changes = 0;
    component.preferencesChange.subscribe(() => changes++);

    const taskCheckbox = await loader.getHarness(
      MatCheckboxHarness.with({label: 'Task notifications'}),
    );
    const portfolioCheckbox = await loader.getHarness(
      MatCheckboxHarness.with({label: 'Portfolio notifications'}),
    );

    await taskCheckbox.check();
    await portfolioCheckbox.check();

    expect(changes).toBe(2);
  });

  it('reports a new summary email cadence so the enclosing form can be marked dirty', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    let changes = 0;
    component.preferencesChange.subscribe(() => changes++);

    const select = await loader.getHarness(MatSelectHarness);
    await select.open();
    await select.clickOptions({text: 'Daily'});

    expect(component.user.digestFrequency).toBe('daily');
    expect(changes).toBe(1);
  });

  it('shows help text for each notification category', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Due dates, changed dates and task status updates.');
    expect(text).toContain('help requests and extension requests');
    expect(text).toContain('New comments, feedback, and review outcomes.');
    expect(text).toContain('Portfolio processing and assessment updates.');
    expect(text).toContain('Session reminders arrive 30 minutes before a session starts.');
  });

  it('associates each checkbox with its help text', () => {
    const inputs = fixture.nativeElement.querySelectorAll(
      '.notification-setting > mat-checkbox input[type="checkbox"]',
    );
    const descriptions = fixture.nativeElement.querySelectorAll(
      '.notification-setting:not(.notification-setting--choice) small[id]',
    );
    const descriptionIds = [
      'task-notification-description',
      'feedback-notification-description',
      'portfolio-notification-description',
      'unit-hub-notification-description',
    ];

    expect(inputs.length).toBe(4);
    expect(descriptions.length).toBe(4);

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

  it('offers a cadence for the summary email and explains the one chosen', () => {
    const component = fixture.componentInstance;

    expect(component.digestOptions.map((option) => option.value)).toEqual([
      'off',
      'daily',
      'weekly',
      'monthly',
    ]);

    component.user.digestFrequency = 'monthly';
    expect(component.digestHelp).toBe('How the trimester is going so far.');

    // Never is a real choice here, separate from feedback notifications.
    component.user.digestFrequency = 'off';
    expect(component.digestHelp).toBe('No summary email.');
  });

  it('describes the cadence control the way the checkboxes are described', () => {
    const select = fixture.nativeElement.querySelector('mat-select');
    const help = fixture.nativeElement.querySelector('#digest-frequency-description');

    expect(select?.getAttribute('aria-describedby')).toBe('digest-frequency-description');
    expect(help).not.toBeNull();
  });

  // label[for] cannot name the select, because Material puts role="combobox" on
  // the select's own element rather than on a form control.
  it('names the cadence control with the label beside it', () => {
    const select = fixture.nativeElement.querySelector('mat-select');
    const label = fixture.nativeElement.querySelector('#digest-frequency-label');

    expect(label?.textContent.trim()).toBe('Summary email');
    expect(select?.getAttribute('aria-labelledby')?.trim()).toBe('digest-frequency-label');
  });

  it('says nothing rather than guessing when the cadence is unknown', () => {
    fixture.componentInstance.user.digestFrequency = undefined as unknown as string;
    expect(fixture.componentInstance.digestHelp).toBe('');
  });
});
