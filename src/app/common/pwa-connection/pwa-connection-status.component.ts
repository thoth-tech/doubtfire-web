import {DOCUMENT} from '@angular/common';
import {ChangeDetectionStrategy, Component, HostListener, inject, signal} from '@angular/core';

@Component({
  selector: 'f-pwa-connection-status',
  standalone: true,
  templateUrl: './pwa-connection-status.component.html',
  styleUrl: './pwa-connection-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PwaConnectionStatusComponent {
  private readonly document = inject(DOCUMENT);

  // This reports the browser's connection hint, not whether the API is healthy.
  readonly offline = signal(this.document.defaultView?.navigator.onLine === false);

  @HostListener('window:online')
  @HostListener('window:offline')
  updateConnectionStatus(): void {
    this.offline.set(this.document.defaultView?.navigator.onLine === false);
  }
}
