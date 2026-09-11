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
}
