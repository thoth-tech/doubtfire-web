import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {Unit} from 'src/app/api/models/unit';
import {TaskDefinitionService} from 'src/app/api/services/task-definition.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {PDF_ACCEPT, ZIP_ACCEPT, isPdfFile, isZipFile} from '../task-file-types';

@Component({
  selector: 'f-task-definition-resources',
  templateUrl: 'task-definition-resources.component.html',
  styleUrls: ['task-definition-resources.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskDefinitionResourcesComponent {
  @Input() taskDefinition: TaskDefinition;

  public readonly pdfAccept = PDF_ACCEPT;
  public readonly zipAccept = ZIP_ACCEPT;

  constructor(
    private fileDownloaderService: FileDownloaderService,
    private alerts: AlertService,
    private taskDefinitionService: TaskDefinitionService,
    private confirmationModal: ConfirmationModalService,
  ) {}

  public get unit(): Unit {
    return this.taskDefinition?.unit;
  }

  public downloadTaskSheet() {
    this.fileDownloaderService.downloadFile(
      this.taskDefinition.getTaskPDFUrl(),
      this.taskDefinition.name + '.pdf',
    );
  }

  public downloadTaskResources() {
    this.fileDownloaderService.downloadFile(
      this.taskDefinition.getTaskResourcesUrl(true),
      this.taskDefinition.name + '.zip',
    );
  }

  public removeTaskSheet() {
    this.confirmationModal.show(
      'Delete task sheet',
      `Students will no longer be able to download the task sheet for ${this.taskDefinition.abbreviation}.`,
      () =>
        this.taskDefinition.deleteTaskSheet().subscribe({
          next: () => this.alerts.success('Deleted task sheet', 2000),
          error: (message) => this.alerts.error(message, 6000),
        }),
    );
  }

  public removeTaskResources() {
    this.confirmationModal.show(
      'Delete task resources',
      `Students will no longer be able to download the resources for ${this.taskDefinition.abbreviation}.`,
      () =>
        this.taskDefinition.deleteTaskResources().subscribe({
          next: () => this.alerts.success('Deleted task resources', 2000),
          error: (message) => this.alerts.error(message, 6000),
        }),
    );
  }

  public uploadTaskSheet(files: ArrayLike<File>) {
    const validFiles = Array.from(files as ArrayLike<File>).filter(isPdfFile);
    if (validFiles.length > 0) {
      const file = validFiles[0];
      this.taskDefinitionService.uploadTaskSheet(this.taskDefinition, file).subscribe({
        next: () => {
          this.alerts.success('Uploaded task sheet', 2000);
          this.taskDefinition.hasTaskSheet = true;
        },
        error: (message) => this.alerts.error(message, 6000),
      });
    } else {
      this.alerts.error('Please drop a PDF to upload for this task', 6000);
    }
  }

  public uploadTaskResources(files: ArrayLike<File>) {
    const validFiles = Array.from(files as ArrayLike<File>).filter(isZipFile);
    if (validFiles.length > 0) {
      const file = validFiles[0];
      this.taskDefinitionService.uploadTaskResources(this.taskDefinition, file).subscribe({
        next: () => {
          this.alerts.success('Uploaded task resources', 2000);
          this.taskDefinition.hasTaskResources = true;
        },
        error: (message) => this.alerts.error(message, 6000),
      });
    } else {
      this.alerts.error('Please drop a Zip to upload for this task', 6000);
    }
  }
}
