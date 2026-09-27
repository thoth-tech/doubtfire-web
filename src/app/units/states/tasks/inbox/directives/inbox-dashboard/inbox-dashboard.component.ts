import {
  ChangeDetectionStrategy,
  Component,
  DoCheck,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import {MatTabChangeEvent} from '@angular/material/tabs';
import {UnitRole} from 'src/app/api/models/doubtfire-model';
import {Task} from 'src/app/api/models/task';
import {UserService} from 'src/app/api/services/user.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {PanelComponent} from 'src/app/common/panel-layout/panel.component';

enum InboxDashboardTab {
  submission = 0,
  taskSheet = 1,
  similarities = 2,
  overseer = 3,
  staffNotes = 4,
  tutorNotes = 5,
}

@Component({
  selector: 'f-inbox-dashboard',
  templateUrl: './inbox-dashboard.component.html',
  styleUrls: ['./inbox-dashboard.component.scss'],
  host: {'class': 'block h-full'},
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class InboxDashboardComponent implements OnChanges, DoCheck {
  @Input() task: Task;
  // Async, because the URL is announced during change detection and the parent shows
  // it in a button it has already checked by then.
  @Output() visiblePdfUrlChange: EventEmitter<string> = new EventEmitter(true);

  public readonly InboxDashboardTab = InboxDashboardTab;
  public currentTab: InboxDashboardTab = InboxDashboardTab.submission;
  public currentIndex = InboxDashboardTab.submission;

  private lastVisiblePdfUrl: string | null | undefined = undefined;
  /** The layout panel this dashboard sits in. The phone layout has none. */
  private readonly panel = inject(PanelComponent, {optional: true});

  constructor(
    private fileDownloader: FileDownloaderService,
    private userService: UserService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.task) {
      // Always announce for a new task. The parent also hears about the selection from
      // the selected task service, which does not check there is a PDF to show.
      this.lastVisiblePdfUrl = undefined;
      this.selectDefaultTab();
    }
  }

  // The submission details, and with them whether there is a PDF, arrive after the
  // task is selected. Announcing the URL only when the tab changed left the phone
  // layout's download button off for a submission that had since loaded.
  ngDoCheck(): void {
    this.announceVisiblePdfUrl();
  }

  onTabChange(event: MatTabChangeEvent): void {
    this.setSelectedTab(event.index as InboxDashboardTab);
  }

  downloadSubmission(): void {
    if (!this.task?.hasPdf) {
      return;
    }

    this.fileDownloader.downloadFile(this.task.submissionUrl(true), 'submission.pdf');
  }

  downloadSubmittedFiles(): void {
    if (!this.task) {
      return;
    }

    this.fileDownloader.downloadFile(this.task.submittedFilesUrl(), 'submitted-files.zip');
  }

  /** Full screen, the reading tabs keep a comfortable line length in the middle. */
  public get readingMeasure(): boolean {
    return !!this.panel?.isFullscreen;
  }

  public get overseerEnabled(): boolean {
    return this.task?.overseerEnabled ?? false;
  }

  private selectDefaultTab(): void {
    this.setSelectedTab(InboxDashboardTab.submission);
  }

  private setSelectedTab(tab: InboxDashboardTab): void {
    this.currentTab = tab;
    this.currentIndex = tab;
    this.announceVisiblePdfUrl();
  }

  private announceVisiblePdfUrl(): void {
    const url = this.pdfUrlForTab(this.currentTab);
    if (url === this.lastVisiblePdfUrl) {
      return;
    }

    this.lastVisiblePdfUrl = url;
    this.visiblePdfUrlChange.emit(url);
  }

  private pdfUrlForTab(tab: InboxDashboardTab): string {
    if (!this.task) {
      return null;
    }

    switch (tab) {
      case InboxDashboardTab.submission:
        return this.task.hasPdf ? this.task.submissionUrl() : null;
      case InboxDashboardTab.taskSheet:
        return this.task.definition?.hasTaskSheet ? this.task.definition.getTaskPDFUrl() : null;
      default:
        return null;
    }
  }

  public get currentUnitRole(): UnitRole | undefined {
    const currentUser = this.userService.currentUser;
    if (!currentUser) {
      return undefined;
    }

    return this.task?.unit?.staff?.find((ur) => ur.user?.id === currentUser.id);
  }

  public get canAccessTutorNotes(): boolean {
    const tutor = this.task?.tutor;
    if (!tutor) {
      return false;
    }

    if (!this.currentUnitRole) {
      return false;
    }

    // Ensure the unit is mapped correctly to access the mentor
    tutor.unit = this.task.unit;

    const canAccess =
      this.currentUnitRole.role === 'Convenor' ||
      this.currentUnitRole.role === 'Admin' ||
      (tutor.mentor && tutor.mentor.id === this.currentUnitRole.id);

    return canAccess;
  }
}
