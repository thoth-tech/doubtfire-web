import {
  ChangeDetectionStrategy,
  Component,
  DoCheck,
  ElementRef,
  Input,
  ViewChild,
  inject,
} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {PanelComponent} from './panel.component';

/**
 * Takes the `app-panel` it sits in full screen, from a control row inside that panel's own
 * content, such as a tab bar. Outside a panel, or while the panels are stacked one at a
 * time on a small screen, it renders nothing.
 *
 * Leaving full screen by any route (this button, Esc) puts focus back on the button, as
 * long as focus was still somewhere in the panel. A swap to another full-screen panel
 * leaves focus where the user put it.
 */
@Component({
  selector: 'app-panel-fullscreen-button',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  host: {class: 'app-panel-fullscreen-button'},
  styleUrl: './panel-fullscreen-button.component.scss',
  templateUrl: './panel-fullscreen-button.component.html',
})
export class PanelFullscreenButtonComponent implements DoCheck {
  /** Classes for the button, to match the icon buttons beside it. */
  @Input() public buttonClass = '';

  public readonly panel = inject(PanelComponent, {optional: true});

  @ViewChild('toggle', {read: ElementRef}) private toggle?: ElementRef<HTMLButtonElement>;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private wasFullscreen = false;

  public get visible(): boolean {
    return !!this.panel && !this.panel.stacked;
  }

  public get isFullscreen(): boolean {
    return !!this.panel?.isFullscreen;
  }

  public get label(): string {
    return this.isFullscreen ? 'Exit full screen' : `Open ${this.panel?.panelTitle} full screen`;
  }

  public ngDoCheck(): void {
    const fullscreen = this.isFullscreen;
    if (this.wasFullscreen && !fullscreen) {
      // After this check has finished, so a blur elsewhere does not land mid-render.
      void Promise.resolve().then(() => this.restoreFocus());
    }
    this.wasFullscreen = fullscreen;
  }

  public toggleFullscreen(): void {
    this.panel?.toggleFullscreen();
  }

  private restoreFocus(): void {
    const button = this.toggle?.nativeElement;
    // Gone when the layout left full screen because the panels stacked.
    if (!button || !this.host.nativeElement.contains(button)) {
      return;
    }
    const panelElement = this.host.nativeElement.closest('app-panel');
    // Another panel went full screen in this one's place, so this one is out of reach.
    if (panelElement?.hasAttribute('inert')) {
      return;
    }
    const active = document.activeElement;
    const focusWasInPanel =
      !active || active === document.body || (!!panelElement && panelElement.contains(active));
    if (focusWasInPanel && active !== button) {
      button.focus();
    }
  }
}
