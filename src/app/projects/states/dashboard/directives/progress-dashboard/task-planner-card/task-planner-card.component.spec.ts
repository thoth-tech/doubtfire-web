import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatSelectModule} from '@angular/material/select';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Project} from 'src/app/api/models/project';
import {Task} from 'src/app/api/models/task';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {Unit} from 'src/app/api/models/unit';
import {buildIcsCalendar} from 'src/app/api/services/ics-calendar-builder';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {TaskPlannerCardComponent} from './task-planner-card.component';

function buildProjectWithTasks(
  tasks: {dueDate?: Date; targetGrade?: number}[],
  projectTargetGrade: number | undefined = 0,
): Project {
  const unit = new Unit();
  unit.id = 7;
  unit.code = 'COS10001';
  unit.allowFlexibleDates = false;

  const project = new Project(unit);
  project.targetGrade = projectTargetGrade;

  tasks.forEach(({dueDate, targetGrade}, index) => {
    const definition = new TaskDefinition(unit);
    definition.id = index + 1;
    definition.abbreviation = `${index + 1}.1P`;
    definition.name = `Task ${index + 1}`;
    definition.targetGrade = targetGrade ?? 0;
    definition.targetDate = dueDate;

    const task = new Task(unit);
    task.id = index + 1;
    task.definition = definition;
    task.dueDate = dueDate;
    task.project = project;

    project.taskCache.add(task);
  });

  return project;
}

describe('TaskPlannerCardComponent', () => {
  let component: TaskPlannerCardComponent;
  let fixture: ComponentFixture<TaskPlannerCardComponent>;
  let fileDownloaderStub: {
    downloadBlobToFile: ReturnType<typeof vi.fn>;
    releaseBlob: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    fileDownloaderStub = {
      downloadBlobToFile: vi.fn(),
      releaseBlob: vi.fn(),
    };

    await TestBed.configureTestingModule({
      declarations: [TaskPlannerCardComponent],
      imports: [MatButtonModule, MatIconModule, MatSelectModule, FormsModule, NoopAnimationsModule],
      providers: [{provide: FileDownloaderService, useValue: fileDownloaderStub}, GradeService],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskPlannerCardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('disables the download button when there are no active tasks yet', () => {
    // Simulates the dashboard's progressive resolution (project.resolver.ts), where
    // project.tasks can still be empty on first render.
    component.project = buildProjectWithTasks([]);
    fixture.detectChanges();

    const downloadButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.download-ics-link');

    expect(downloadButton).not.toBeNull();
    expect(downloadButton.disabled).toBe(true);
  });

  it('enables the download button once tasks at the selected grade are present', () => {
    component.project = buildProjectWithTasks([{dueDate: new Date(2026, 8, 15, 23, 59, 59, 999)}]);
    fixture.detectChanges();

    const downloadButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.download-ics-link');

    expect(downloadButton.disabled).toBe(false);
  });

  it('stacks the planner controls with space for the floating grade label', () => {
    component.project = buildProjectWithTasks([]);
    fixture.detectChanges();

    const controls: HTMLElement = fixture.nativeElement.querySelector('.task-planner-controls');
    const plannerButton = controls.querySelector('button');
    const gradeField = controls.querySelector('mat-form-field');
    const downloadButton = controls.querySelector('.download-ics-link');

    expect(controls.classList.contains('flex-col')).toBe(true);
    expect(controls.classList.contains('gap-4')).toBe(true);
    expect(plannerButton?.nextElementSibling).toBe(gradeField);
    expect(gradeField?.nextElementSibling).toBe(downloadButton);
  });

  it('does not call the file downloader when there are no active tasks, guarding against an empty file', () => {
    component.project = buildProjectWithTasks([]);
    fixture.detectChanges();

    component.downloadIcs();

    expect(fileDownloaderStub.downloadBlobToFile).not.toHaveBeenCalled();
    expect(fileDownloaderStub.releaseBlob).not.toHaveBeenCalled();
  });

  it('downloads a blob named after the unit code and the selected grade abbreviation', () => {
    component.project = buildProjectWithTasks([{dueDate: new Date(2026, 8, 15, 23, 59, 59, 999)}]);
    fixture.detectChanges();

    const createObjectURLSpy = vi
      .spyOn(window.URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url');

    expect(component.hasDownloadableTasks).toBe(true);
    component.downloadIcs();

    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    const [blobArg] = createObjectURLSpy.mock.calls[0];
    expect((blobArg as Blob).type).toBe('text/calendar;charset=utf-8');
    // Default project.targetGrade is 0 (Pass, abbreviation 'P').
    expect(fileDownloaderStub.downloadBlobToFile).toHaveBeenCalledWith(
      'blob:mock-url',
      'COS10001-tasks-P.ics',
    );
    expect(fileDownloaderStub.releaseBlob).toHaveBeenCalledWith('blob:mock-url');
  });

  it('defaults selectedDownloadGrade to project.targetGrade', () => {
    component.project = buildProjectWithTasks([], 2);
    fixture.detectChanges();

    expect(component.selectedDownloadGrade).toBe(2);
  });

  it('falls back to the highest grade value when project.targetGrade is not set', () => {
    const project = buildProjectWithTasks([]);
    project.targetGrade = undefined;
    component.project = project;
    fixture.detectChanges();

    // GradeService.gradeValues is [0, 1, 2, 3], the highest is 3 (High Distinction).
    expect(component.selectedDownloadGrade).toBe(3);
  });

  it('does not persist the selection: does not write project.targetGrade', () => {
    component.project = buildProjectWithTasks([], 1);
    fixture.detectChanges();

    component.selectedDownloadGrade = 3;

    expect(component.project.targetGrade).toBe(1);
  });

  it('only includes tasks at or below the selected grade in the generated calendar', () => {
    // Two tasks: one at grade 0 (Pass), one at grade 2 (Distinction). If the grade filter
    // were ignored, both event UIDs would be present in the generated calendar.
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), targetGrade: 0},
      {dueDate: new Date(2026, 8, 20, 23, 59, 59, 999), targetGrade: 2},
    ]);
    fixture.detectChanges();
    component.selectedDownloadGrade = 0;

    const selectedTasks = component['tasksForSelectedGrade']();
    const ics = buildIcsCalendar(selectedTasks, new Date('2026-08-24T00:00:00Z'));
    expect(selectedTasks.map((task) => task.definition.id)).toEqual([1]);
    expect(ics).toContain('UID:E-1');
    expect(ics).not.toContain('UID:E-2');
  });

  it('hasDownloadableTasks reflects the selected grade, not just whether any task exists', () => {
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), targetGrade: 2},
    ]);
    fixture.detectChanges();

    component.selectedDownloadGrade = 0;
    expect(component.hasDownloadableTasks).toBe(false);

    component.selectedDownloadGrade = 2;
    expect(component.hasDownloadableTasks).toBe(true);
  });

  it('includes the selected grade abbreviation in the filename, not the default', () => {
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), targetGrade: 0},
    ]);
    fixture.detectChanges();
    component.selectedDownloadGrade = 1; // Credit, abbreviation 'C'.

    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');

    component.downloadIcs();

    expect(fileDownloaderStub.downloadBlobToFile).toHaveBeenCalledWith(
      'blob:mock-url',
      'COS10001-tasks-C.ics',
    );
  });
});
