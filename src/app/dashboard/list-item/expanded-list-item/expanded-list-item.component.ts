import {Component, Input} from '@angular/core';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {DashboardTask} from '../dashboard-list-item.component';

@Component({
  selector: 'f-expanded-list-item',
  standalone: false,
  templateUrl: './expanded-list-item.component.html',
  styleUrls: ['./expanded-list-item.component.scss'],
})
export class DashboardExpandedListItemComponent {
  @Input() task: DashboardTask;

  constructor(private fileDownloader: FileDownloaderService) {}

  downloadTaskSheet() {
    this.fileDownloader.downloadFile(
      this.task.taskDef.getTaskPDFUrl(true),
      `${this.task.unitCode}-${this.task.abbreviation}-TaskSheet.pdf`,
    );
  }

  downloadResources() {
    this.fileDownloader.downloadFile(
      this.task.taskDef.getTaskResourcesUrl(true),
      `${this.task.unitCode}-${this.task.abbreviation}-TaskResources.zip`,
    );
  }
}
