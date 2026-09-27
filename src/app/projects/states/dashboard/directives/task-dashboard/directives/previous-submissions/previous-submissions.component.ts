import {DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {Subscription} from 'rxjs';
import {Task} from 'src/app/api/models/task';
import {
  StudentSubmissionVersion,
  SubmissionHistoryService,
} from 'src/app/api/services/submission-history.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';

@Component({
  selector: 'f-previous-submissions',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatCardModule],
  templateUrl: './previous-submissions.component.html',
  styleUrls: ['./previous-submissions.component.scss'],
})
export class PreviousSubmissionsComponent implements OnChanges, OnDestroy {
  @Input() task: Task;
  versions: StudentSubmissionVersion[] = [];
  loading = false;
  processing = false;
  error = '';
  downloadingId: number | null = null;
  private request?: Subscription;
  private generation = 0;

  constructor(
    private history: SubmissionHistoryService,
    private downloader: FileDownloaderService,
  ) {}

  ngOnChanges(): void {
    this.refresh();
  }

  ngOnDestroy(): void {
    this.generation++;
    this.request?.unsubscribe();
  }

  refresh(): void {
    this.request?.unsubscribe();
    this.generation++;
    this.versions = [];
    this.processing = false;
    this.loading = false;
    this.error = '';
    this.downloadingId = null;
    if (!this.task?.id) {
      return;
    }
    this.loading = true;
    this.request = this.history.queryStudentHistory(this.task).subscribe({
      next: (result) => {
        this.loading = false;
        this.versions = result.versions;
        this.processing = result.processing;
      },
      error: () => {
        this.loading = false;
        this.error = 'Previous submissions could not be loaded. Try again.';
      },
    });
  }

  download(version: StudentSubmissionVersion): void {
    if (!version.available || this.downloadingId !== null) {
      return;
    }
    const generation = this.generation;
    this.downloadingId = version.id;
    this.error = '';
    this.downloader.downloadBlob(
      this.history.studentArchiveUrl(this.task, version.id),
      (url) => {
        if (generation === this.generation) {
          this.downloader.downloadBlobToFile(url, `submission-${version.id}.zip`);
          this.downloadingId = null;
        }
        this.downloader.releaseBlob(url);
      },
      () => {
        if (generation === this.generation) {
          this.downloadingId = null;
          this.error =
            'These archived files are no longer available, or you no longer have access. Refresh the list or try again.';
        }
      },
    );
  }
}
