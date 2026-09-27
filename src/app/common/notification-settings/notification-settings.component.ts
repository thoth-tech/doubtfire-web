import {Component, EventEmitter, Input, Output} from '@angular/core';
import {User} from 'src/app/api/models/user/user';

@Component({
  selector: 'f-notification-settings',
  templateUrl: './notification-settings.component.html',
  styleUrl: './notification-settings.component.scss',
  standalone: false,
})
export class NotificationSettingsComponent {
  @Input({required: true}) user!: User;

  /**
   * Show the link to the notifications page. Off by default because the same
   * settings also render in the admin Users dialog, where the user belongs to
   * someone else, and on the first-login setup form.
   */
  @Input() showNotificationsLink = false;

  /**
   * The summary email's cadence. 'off' stops it without also turning off
   * feedback notifications, which used to be the only switch it had.
   */
  public readonly digestOptions: {value: string; label: string; help: string}[] = [
    {value: 'off', label: 'Never', help: 'No summary email.'},
    {value: 'daily', label: 'Daily', help: 'What is due next, every morning.'},
    {value: 'weekly', label: 'Weekly', help: 'Deadlines and how you are tracking.'},
    {value: 'monthly', label: 'Monthly', help: 'How the trimester is going so far.'},
  ];

  public get digestHelp(): string {
    return (
      this.digestOptions.find((option) => option.value === this.user?.digestFrequency)?.help ?? ''
    );
  }

  /**
   * Fires when the user toggles a category. The checkboxes use standalone
   * ngModels, so they never join the enclosing profile form, and that form
   * needs this to know it has unsaved changes.
   */
  @Output() preferencesChange: EventEmitter<void> = new EventEmitter();
}
