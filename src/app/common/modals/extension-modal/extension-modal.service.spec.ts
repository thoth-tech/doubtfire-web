import {describe, expect, it, vi} from 'vitest';
import {MatDialog, MatDialogConfig} from '@angular/material/dialog';
import {Task} from 'src/app/api/models/task';
import {ExtensionModalComponent} from './extension-modal.component';
import {ExtensionModalService} from './extension-modal.service';

describe('ExtensionModalService', () => {
  it('opens a centred finite-height dialog without focusing the textarea', () => {
    const dialogRef = {};
    const open = vi.fn((_component: unknown, _config: MatDialogConfig) => dialogRef);
    const service = new ExtensionModalService({open} as unknown as MatDialog);

    expect(service.show({} as Task)).toBe(dialogRef);

    const config = open.mock.calls[0][1] as MatDialogConfig;
    expect(config).toMatchObject({
      autoFocus: 'dialog',
      closeOnNavigation: true,
      maxHeight: 'calc(100dvh - 2rem)',
      maxWidth: '560px',
      restoreFocus: true,
      width: 'calc(100vw - 2rem)',
    });
    expect(config.position).toBeUndefined();

    const canClose = vi.fn(() => false);
    expect(
      config.closePredicate(undefined, config, {canClose} as unknown as ExtensionModalComponent),
    ).toBe(false);
    expect(canClose).toHaveBeenCalled();
  });
});
