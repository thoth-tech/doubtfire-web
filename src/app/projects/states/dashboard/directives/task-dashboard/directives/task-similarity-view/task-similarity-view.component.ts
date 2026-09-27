import {HttpResponse} from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import {MatExpansionPanelHeader} from '@angular/material/expansion';
import {Subscription} from 'rxjs';
import {Task} from 'src/app/api/models/task';
import {TaskSimilarity} from 'src/app/api/models/task-similarity';
import {TaskSimilarityService} from 'src/app/api/services/task-similarity.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {JplagReportViewerComponent} from 'src/app/projects/states/jplag/jplag-report-viewer.component';
import {SelectedTaskService} from '../../../../selected-task.service';

@Component({
  selector: 'f-task-similarity-view',
  templateUrl: './task-similarity-view.component.html',
  styleUrls: ['./task-similarity-view.component.scss'],
  // The tab owns its scroll: the header stays put and only the list moves.
  host: {class: 'flex h-full min-h-0 flex-col'},
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskSimilarityViewComponent implements OnChanges {
  @Input() task: Task;
  @ViewChild('jplagViewer') jplagViewer!: JplagReportViewerComponent;
  @ViewChildren(MatExpansionPanelHeader) panelHeaders?: QueryList<MatExpansionPanelHeader>;
  panelOpenState = false;
  jplagOpenState = false;
  loading = false;
  /** The last fetch failed, so the tab offers a retry instead of saying there are none. */
  loadError = false;

  private similaritiesSub?: Subscription;

  constructor(
    private taskSimilarityService: TaskSimilarityService,
    private alertsService: AlertService,
    private selectedTaskService: SelectedTaskService,
    private fileDownloaderService: FileDownloaderService,
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes.task && changes.task.currentValue && this.task?.id) {
      this.jplagOpenState = false;
      this.loadSimilarities();
    }
  }

  loadSimilarities(): void {
    // A task change can start a fetch before the last one returns, so drop the older one.
    this.similaritiesSub?.unsubscribe();
    this.loading = true;
    this.loadError = false;

    this.similaritiesSub = this.task.fetchSimilarities().subscribe({
      next: () => {
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
      complete: () => {
        this.loading = false;
      },
    });
  }

  /** Collapse all is only worth showing while there is something open to collapse. */
  hasOpenPanel(similarities: readonly TaskSimilarity[]): boolean {
    return similarities.some((similarity) => similarity.parts?.some((part) => part.panelOpenState));
  }

  // The panels bind their expanded state to the part, so clearing it closes them.
  collapseAll(): void {
    for (const similarity of this.task?.similarityCache.currentValues ?? []) {
      for (const part of similarity.parts ?? []) {
        part.panelOpenState = false;
      }
    }
    this.focusFirstPanel();
  }

  closeJplagReport(): void {
    this.jplagOpenState = false;
    this.focusFirstPanel();
  }

  // Collapse all and Back to summary both leave the page once used, which would drop
  // keyboard focus to the page body. Hand it to the first similarity instead, once the
  // list has rendered.
  private focusFirstPanel(): void {
    setTimeout(() => this.panelHeaders?.first?.focus());
  }

  toggleFlag(e: Event, similarity: TaskSimilarity) {
    e.stopPropagation();
    similarity.flagged = !similarity.flagged;
    this.taskSimilarityService
      .update({taskId: similarity.task.id, id: similarity.id}, {entity: similarity})
      .subscribe((_) => {
        this.alertsService.success('Similarity flag updated');
        similarity.task.similarityFlag = similarity.task.similarityCache.currentValues
          .map((s) => {
            return s.flagged;
          })
          .reduce((a, b) => a || b, false);
        this.selectedTaskService.checkFooterHeight();
      });
  }

  openReport(e: Event, similarity: TaskSimilarity) {
    e.stopPropagation();
    // Open similarity report in new tab
    similarity.fetchSimilarityReportUrl().subscribe({
      next: (url) => {
        window.open(url, '_blank');
      },
      error: (err) => {
        this.alertsService.error(`Error accessing TurnItIn: ${err}`);
      },
    });
  }

  viewJplagReport(similarity: TaskSimilarity) {
    // Students are identified by their username in JPlag reports (configured by API)
    // In most cases, usernames are a combination of their first and last names
    this.fileDownloaderService.downloadBlob(
      this.task.definition.getJplagReportUrl(),
      (_, response: HttpResponse<Blob>) => {
        // Open JPlag report viewer in embedded iframe
        setTimeout(() => {
          this.jplagViewer.uploadReport(response.body);
          setTimeout(() => {
            // Open comparison between the two students
            this.jplagViewer.openComparison(
              similarity.task.project.student.username,
              similarity.otherStudent.username,
            );
            this.jplagOpenState = true;
          }, 100);
        }, 100);
      },
      (error) => {
        console.error(error);
      },
    );
  }
}
