import {ChangeDetectionStrategy, Component, Input, inject} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {PanelComponent} from './panel.component';

/**
 * Collapses the `app-panel` it sits in, from inside that panel's own content: a list's
 * header row, a tab bar. Outside a panel, or when the panel cannot collapse right now
 * (stacked, full screen, already a rail), it renders nothing.
 */
@Component({
  selector: 'app-panel-collapse-button',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  host: {class: 'app-panel-collapse-button'},
  styleUrl: './panel-collapse-button.component.scss',
  templateUrl: './panel-collapse-button.component.html',
})
export class PanelCollapseButtonComponent {
  /** Classes for the button, to match the icon buttons beside it. */
  @Input() public buttonClass = '';

  public readonly panel = inject(PanelComponent, {optional: true});
}
