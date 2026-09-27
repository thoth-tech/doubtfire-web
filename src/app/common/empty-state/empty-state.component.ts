import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

/**
 * Small, centered empty-state block for tables and lists that would otherwise
 * show a header and blank space: an icon, a main line, an optional supporting
 * line and an optional action. Colours come from the theme tokens so it flips
 * light/dark for free.
 *
 * Two ways to fill it. With a heading, the heading is the main line and the
 * message supports it. Without one, the message is the main line and the hint
 * supports it.
 *
 * Render it only when the collection is confirmed empty, not while it is still
 * loading and not when the load failed - "you have none" and "we could not find
 * out" are different states and only one of them has a way out.
 */
@Component({
  selector: 'f-empty-state',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class EmptyStateComponent {
  @Input() icon?: string;
  @Input() heading?: string;
  @Input() message = 'Nothing to show';
  @Input() hint?: string;

  /** Omit to render no action. */
  @Input() actionLabel?: string;
  @Output() action: EventEmitter<void> = new EventEmitter();
}
