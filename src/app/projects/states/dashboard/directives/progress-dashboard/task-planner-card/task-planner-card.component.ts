import {ChangeDetectionStrategy, Component, Inject, Input, OnInit} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {Project} from 'src/app/api/models/project';
import {Task} from 'src/app/api/models/task';
import {buildIcsCalendar} from 'src/app/api/services/ics-calendar-builder';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {
  DownloadDirection,
  DownloadFilterDialogComponent,
  DownloadFilterSelection,
} from './download-filter-dialog/download-filter-dialog.component';

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

  /**
   * Local to the download only, not persisted, same as selectedDownloadGrade above. Defaults to
   * "up to this grade" so an existing user's download is unchanged until they open the dialog
   * and choose otherwise.
   */
  public downloadDirection: DownloadDirection = 'upTo';

  /**
   * Local to the download only, not persisted, same as selectedDownloadGrade above. Defaults to
   * true: someone downloading a calendar of due dates almost always wants the work still ahead
   * of them, not tasks they already finished. The checkbox stays available to see the full set.
   */
  public excludeCompleted = true;

  constructor(
    @Inject(FileDownloaderService) private fileDownloader: FileDownloaderService,
    private gradeService: GradeService,
    private dialog: MatDialog,
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
   * still be empty on first render. Gates the button so it cannot open the dialog before tasks
   * have loaded. Deliberately does not consider the filter selection: that selection now lives
   * in the dialog, and a zero-result selection is guarded there instead, via canConfirm.
   */
  public get hasDownloadableTasks(): boolean {
    return !!this.project && this.project.tasks.length > 0;
  }

  private tasksForSelectedGrade(
    grade: number = this.selectedDownloadGrade,
    direction: DownloadDirection = this.downloadDirection,
  ): Task[] {
    return this.project.tasks.filter((task) =>
      direction === 'andAbove'
        ? task.definition.targetGrade >= grade
        : task.definition.targetGrade <= grade,
    );
  }

  private tasksForDownload(
    grade: number = this.selectedDownloadGrade,
    direction: DownloadDirection = this.downloadDirection,
    excludeCompleted: boolean = this.excludeCompleted,
  ): Task[] {
    const tasks = this.tasksForSelectedGrade(grade, direction);
    return excludeCompleted ? tasks.filter((task) => !task.inFinalState()) : tasks;
  }

  public openDownloadDialog(): void {
    if (!this.hasDownloadableTasks) {
      return;
    }

    const dialogRef = this.dialog.open(DownloadFilterDialogComponent, {
      data: {
        gradeValues: this.gradeValues,
        gradeLabel: (grade: number) => this.gradeLabel(grade),
        initialGrade: this.selectedDownloadGrade,
        initialDirection: this.downloadDirection,
        initialExcludeCompleted: this.excludeCompleted,
        matchingTaskCount: (
          grade: number,
          direction: DownloadDirection,
          excludeCompleted: boolean,
        ) => this.tasksForDownload(grade, direction, excludeCompleted).length,
      },
      width: 'calc(100vw - 32px)',
      maxWidth: '480px',
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe((selection?: DownloadFilterSelection) => {
      if (!selection) {
        return;
      }

      this.selectedDownloadGrade = selection.grade;
      this.downloadDirection = selection.direction;
      this.excludeCompleted = selection.excludeCompleted;
      this.downloadIcs();
    });
  }

  public downloadIcs(): void {
    const tasks = this.tasksForDownload();
    if (tasks.length === 0) {
      return;
    }

    const ics = buildIcsCalendar(tasks);
    const blob = new Blob([ics], {type: 'text/calendar;charset=utf-8'});
    const url = window.URL.createObjectURL(blob);
    const directionSuffix = this.downloadDirection === 'andAbove' ? '-and-above' : '';
    const completedSuffix = this.excludeCompleted ? '-outstanding' : '';
    const filename = `${this.project.unit.code}-tasks-${this.unit.gradeAbbreviation(this.selectedDownloadGrade)}${directionSuffix}${completedSuffix}.ics`;

    this.fileDownloader.downloadBlobToFile(url, filename);
    this.fileDownloader.releaseBlob(url);
  }
}
