import {ChangeDetectionStrategy, Component, Inject, Input, OnInit} from '@angular/core';
import {Project} from 'src/app/api/models/project';
import {Task} from 'src/app/api/models/task';
import {buildIcsCalendar} from 'src/app/api/services/ics-calendar-builder';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {GradeService} from 'src/app/common/services/grade.service';

@Component({
  selector: 'f-task-planner-card',
  templateUrl: './task-planner-card.component.html',
  styleUrl: './task-planner-card.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskPlannerCardComponent implements OnInit {
  @Input() project: Project;
  public get unit() {
    return this.project?.unit;
  }

  /**
   * Local to the download only, not persisted. Deliberately never written back through
   * projectService.update or to project.targetGrade, the Target Grade card on this same
   * dashboard is intentionally read-only, this selector must not become a second way to
   * change the saved grade.
   */
  public selectedDownloadGrade: number;

  constructor(
    @Inject(FileDownloaderService) private fileDownloader: FileDownloaderService,
    private gradeService: GradeService,
  ) {}

  ngOnInit(): void {
    this.selectedDownloadGrade = this.project?.targetGrade ?? Math.max(...this.gradeValues);
  }

  public get gradeValues(): number[] {
    return this.gradeService.gradeValuesFor(this.unit);
  }

  public gradeLabel(grade: number): string {
    return this.gradeService.gradeLabel(grade, this.unit);
  }

  /**
   * The dashboard route resolves progressively (project.resolver.ts), so project.tasks can
   * still be empty on first render. Gates the button so it cannot be clicked before tasks
   * have loaded, rather than producing a technically-valid but empty .ics file.
   */
  public get hasDownloadableTasks(): boolean {
    return !!this.project && this.tasksForSelectedGrade().length > 0;
  }

  private tasksForSelectedGrade(): Task[] {
    return this.project.tasks.filter(
      (task) => task.definition.targetGrade <= this.selectedDownloadGrade,
    );
  }

  public downloadIcs(): void {
    if (!this.hasDownloadableTasks) {
      return;
    }

    const ics = buildIcsCalendar(this.tasksForSelectedGrade());
    const blob = new Blob([ics], {type: 'text/calendar;charset=utf-8'});
    const url = window.URL.createObjectURL(blob);
    const filename = `${this.project.unit.code}-tasks-${this.unit.gradeAbbreviation(this.selectedDownloadGrade)}.ics`;

    this.fileDownloader.downloadBlobToFile(url, filename);
    this.fileDownloader.releaseBlob(url);
  }
}
