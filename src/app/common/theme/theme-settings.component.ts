import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatRadioChange} from '@angular/material/radio';
import {ThemePreference, ThemeService} from './theme.service';

/**
 * The THM-F02 Light/Dark/System control: three explicit, named, keyboard- and
 * screen-reader-accessible choices, backed directly by the THM-F01 service. It
 * only ever reads `preference` (the stored choice) and writes through
 * `setPreference`; persistence, account sync and storage-failure fallback all
 * live in the service, not here.
 */
@Component({
  selector: 'f-theme-settings',
  templateUrl: './theme-settings.component.html',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeSettingsComponent {
  private readonly theme = inject(ThemeService);
  readonly preference = this.theme.preference;

  onPreferenceChange(change: MatRadioChange): void {
    this.theme.setPreference(change.value as ThemePreference);
  }
}
