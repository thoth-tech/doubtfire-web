import {Component, Input} from '@angular/core';
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
}
