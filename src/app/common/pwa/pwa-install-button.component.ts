import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {PwaInstallDialogComponent} from './pwa-install-dialog.component';
import {PwaInstallService} from './pwa-install.service';

@Component({
  selector: 'f-pwa-install-button',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './pwa-install-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PwaInstallButtonComponent {
  readonly pwaInstall = inject(PwaInstallService);
  private readonly dialog = inject(MatDialog);

  openInstallHelp(): void {
    this.dialog.open(PwaInstallDialogComponent, {
      width: '560px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-heading',
    });
  }
}
