import {Component, inject} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {ThemePreference, ThemeService} from './theme.service';

/**
 * THM-F01 implementation proof (contract section 13). Every colour on this page
 * resolves from a --ot-* token off the data-ot-theme marker, so switching the
 * preference repaints the whole page with no reload. The three-button switch
 * here is a throwaway proof control that drives ThemeService directly; the
 * accessible product toggle is THM-F02, deliberately not used here.
 */
@Component({
  selector: 'app-theme-demo',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './theme-demo.component.html',
  styleUrl: './theme-demo.component.scss',
})
export class ThemeDemoComponent {
  private readonly theme = inject(ThemeService);
  readonly preference = this.theme.preference;

  readonly preferences: {value: ThemePreference; label: string; icon: string}[] = [
    {value: 'light', label: 'Light', icon: 'light_mode'},
    {value: 'system', label: 'System', icon: 'brightness_auto'},
    {value: 'dark', label: 'Dark', icon: 'dark_mode'},
  ];

  readonly semantic = [
    'page',
    'surface',
    'surface-raised',
    'text',
    'text-muted',
    'border',
    'divider',
    'focus',
    'link',
    'primary',
    'success',
    'warning',
    'error',
    'info',
  ];

  readonly statuses = [
    'ready-for-feedback',
    'not-started',
    'working-on-it',
    'need-help',
    'fix-and-resubmit',
    'feedback-exceeded',
    'redo',
    'discuss',
    'rediscuss',
    'demonstrate',
    'complete',
    'fail',
    'time-exceeded',
    'assess-in-portfolio',
    'attention-required',
  ];

  choose(pref: ThemePreference): void {
    this.theme.setPreference(pref);
  }
}
