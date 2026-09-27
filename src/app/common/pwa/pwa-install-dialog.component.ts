import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatDialogModule} from '@angular/material/dialog';
import {PwaInstallService} from './pwa-install.service';

@Component({
  selector: 'f-pwa-install-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './pwa-install-dialog.component.html',
  styleUrl: './pwa-install-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PwaInstallDialogComponent {
  readonly pwaInstall = inject(PwaInstallService);

  install(): void {
    void this.pwaInstall.install();
  }
}
