import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {ThemeService} from './theme.service';

/**
 * Single-button theme control. Flips between light and dark from whatever is on
 * screen now: it reads the resolved theme for the icon (a sun while dark, a moon
 * while light) and writes the opposite as an explicit preference.
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent {
  private readonly theme = inject(ThemeService);
  readonly isDark = this.theme.isDark;

  toggle(): void {
    this.theme.setPreference(this.isDark() ? 'light' : 'dark');
  }
}
