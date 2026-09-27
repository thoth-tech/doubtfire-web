import {Injectable} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {Task} from 'src/app/api/models/task';
import {ExtensionModalComponent} from './extension-modal.component';

@Injectable({
  providedIn: 'root',
})
export class ExtensionModalService {
  constructor(public dialog: MatDialog) {}

  public show(task: Task, afterApplication?: () => void) {
    const dialogRef: MatDialogRef<ExtensionModalComponent, void> = this.dialog.open(
      ExtensionModalComponent,
      {
        autoFocus: 'dialog',
        closeOnNavigation: true,
        maxHeight: 'calc(100dvh - 2rem)',
        maxWidth: '560px',
        panelClass: 'responsive-task-dialog',
        restoreFocus: true,
        width: 'calc(100vw - 2rem)',
        data: {
          task,
          afterApplication,
        },
        closePredicate: (_result, _config, component) =>
          (component as ExtensionModalComponent | null)?.canClose() ?? true,
      },
    );

    return dialogRef;
  }
}
