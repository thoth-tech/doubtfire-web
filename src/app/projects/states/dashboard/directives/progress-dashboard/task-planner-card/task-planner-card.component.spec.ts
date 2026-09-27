import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatDialog} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {MatSelectModule} from '@angular/material/select';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Subject, of} from 'rxjs';
import {Project} from 'src/app/api/models/project';
import {Task} from 'src/app/api/models/task';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {TaskStatus, TaskStatusEnum} from 'src/app/api/models/task-status';
import {Unit} from 'src/app/api/models/unit';
import {buildIcsCalendar} from 'src/app/api/services/ics-calendar-builder';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {DownloadFilterSelection} from './download-filter-dialog/download-filter-dialog.component';
import {TaskPlannerCardComponent} from './task-planner-card.component';

function buildProjectWithTasks(
  tasks: {dueDate?: Date; targetGrade?: number; status?: TaskStatusEnum}[],
  projectTargetGrade: number | undefined = 0,
): Project {
  const unit = new Unit();
  unit.id = 7;
  unit.code = 'COS10001';
  unit.allowFlexibleDates = false;

  const project = new Project(unit);
  project.targetGrade = projectTargetGrade;

  tasks.forEach(({dueDate, targetGrade, status}, index) => {
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
    if (status) {
      task.status = status;
    }

    project.taskCache.add(task);
  });

  return project;
}

describe('TaskPlannerCardComponent', () => {
  let component: TaskPlannerCardComponent;
  let fixture: ComponentFixture<TaskPlannerCardComponent>;
  let fileDownloaderStub: {
    downloadBlobToFileWithFeedback: ReturnType<typeof vi.fn>;
    releaseBlob: ReturnType<typeof vi.fn>;
  };
  let matDialogStub: {open: ReturnType<typeof vi.fn>};

  beforeEach(async () => {
    fileDownloaderStub = {
      downloadBlobToFileWithFeedback: vi.fn(),
      releaseBlob: vi.fn(),
    };
    matDialogStub = {open: vi.fn()};

    await TestBed.configureTestingModule({
      declarations: [TaskPlannerCardComponent],
      imports: [
        MatButtonModule,
        MatCheckboxModule,
        MatIconModule,
        MatSelectModule,
        FormsModule,
        NoopAnimationsModule,
      ],
      providers: [
        {provide: FileDownloaderService, useValue: fileDownloaderStub},
        {provide: MatDialog, useValue: matDialogStub},
        GradeService,
      ],
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

  it('lets the planner controls wrap with space between them on phones', () => {
    component.project = buildProjectWithTasks([]);
    fixture.detectChanges();

    const controls: HTMLElement = fixture.nativeElement.querySelector('.task-planner-actions');
    const plannerLink = controls.querySelector('a');
    const downloadButton = controls.querySelector('.download-ics-link');

    expect(controls.classList.contains('flex-wrap')).toBe(true);
    expect(controls.classList.contains('gap-2')).toBe(true);
    expect(plannerLink?.nextElementSibling).toBe(downloadButton);
    // The grade field and the exclude-completed choice now live in the download dialog.
    expect(controls.querySelector('mat-form-field')).toBeNull();
    expect(controls.querySelector('mat-checkbox')).toBeNull();
  });

  it('does not call the file downloader when there are no active tasks, guarding against an empty file', () => {
    component.project = buildProjectWithTasks([]);
    fixture.detectChanges();

    component.downloadIcs();

    expect(fileDownloaderStub.downloadBlobToFileWithFeedback).not.toHaveBeenCalled();
    expect(fileDownloaderStub.releaseBlob).not.toHaveBeenCalled();
  });

  it('downloads a blob named after the unit code and the selected grade abbreviation', () => {
    component.project = buildProjectWithTasks([{dueDate: new Date(2026, 8, 15, 23, 59, 59, 999)}]);
    fixture.detectChanges();
    // Pinned false so this test's filename expectation is decoupled from the excludeCompleted
    // default (true) - this test is about the grade/unit code portion of the filename only.
    component.excludeCompleted = false;

    const createObjectURLSpy = vi
      .spyOn(window.URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url');

    expect(component.hasDownloadableTasks).toBe(true);
    component.downloadIcs();

    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    const [blobArg] = createObjectURLSpy.mock.calls[0];
    expect((blobArg as Blob).type).toBe('text/calendar;charset=utf-8');
    // Default project.targetGrade is 0 (Pass, abbreviation 'P').
    expect(fileDownloaderStub.downloadBlobToFileWithFeedback).toHaveBeenCalledWith(
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

  it('opens the download at the current target grade after it changes on the dashboard', async () => {
    const dueDate = new Date(2026, 8, 15, 23, 59, 59, 999);
    component.project = buildProjectWithTasks([
      {dueDate, targetGrade: 0},
      {dueDate, targetGrade: 3},
    ]);
    fixture.detectChanges();
    component.project.targetGrade = 3;
    fixture.detectChanges();

    matDialogStub.open.mockImplementation((_dialog, {data}) => ({
      afterClosed: () => of({grade: data.initialGrade, direction: 'upTo', excludeCompleted: true}),
    }));
    const createObjectURLSpy = vi
      .spyOn(window.URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url');

    component.openDownloadDialog();

    expect(matDialogStub.open.mock.calls[0][1].data.initialGrade).toBe(3);
    const downloaded = await (createObjectURLSpy.mock.calls[0][0] as Blob).text();
    expect(downloaded).toContain('UID:E-1');
    expect(downloaded).toContain('UID:E-2');
    expect(fileDownloaderStub.downloadBlobToFileWithFeedback).toHaveBeenCalledWith(
      'blob:mock-url',
      'COS10001-tasks-HD-outstanding.ics',
    );
  });

  it('keeps following the target grade after accepting the default download grade', () => {
    component.project = buildProjectWithTasks([{dueDate: new Date(2026, 8, 15)}]);
    fixture.detectChanges();
    matDialogStub.open.mockReturnValue({
      afterClosed: () => of({grade: 0, direction: 'upTo', excludeCompleted: true}),
    });
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');

    component.openDownloadDialog();
    component.project.targetGrade = 2;
    matDialogStub.open.mockReturnValue({afterClosed: () => of(undefined)});
    component.openDownloadDialog();

    expect(matDialogStub.open.mock.calls[1][1].data.initialGrade).toBe(2);
  });

  it('preserves an explicit download grade and filters when the saved target changes', () => {
    component.project = buildProjectWithTasks([{dueDate: new Date(2026, 8, 15), targetGrade: 2}]);
    fixture.detectChanges();
    matDialogStub.open.mockReturnValue({
      afterClosed: () => of({grade: 2, direction: 'andAbove', excludeCompleted: false}),
    });
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');

    component.openDownloadDialog();
    component.project.targetGrade = 3;
    matDialogStub.open.mockReturnValue({afterClosed: () => of(undefined)});
    component.openDownloadDialog();

    expect(matDialogStub.open.mock.calls[1][1].data).toMatchObject({
      initialGrade: 2,
      initialDirection: 'andAbove',
      initialExcludeCompleted: false,
    });
    expect(component.project.targetGrade).toBe(3);
  });

  it('resets a local download grade when the dashboard switches to another project', () => {
    const firstProject = buildProjectWithTasks([{dueDate: new Date(2026, 8, 15)}]);
    fixture.componentRef.setInput('project', firstProject);
    fixture.detectChanges();
    matDialogStub.open.mockReturnValue({
      afterClosed: () => of({grade: 3, direction: 'upTo', excludeCompleted: true}),
    });
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    component.openDownloadDialog();

    const nextProject = buildProjectWithTasks([{dueDate: new Date(2026, 8, 20)}], 1);
    nextProject.unit.gradeDefinitions = nextProject.unit.gradeDefinitions.filter(
      (grade) => grade.value <= 1,
    );
    fixture.componentRef.setInput('project', nextProject);
    fixture.detectChanges();
    matDialogStub.open.mockReturnValue({afterClosed: () => of(undefined)});
    component.openDownloadDialog();

    expect(matDialogStub.open.mock.calls[1][1].data).toMatchObject({
      initialGrade: 1,
      gradeValues: [0, 1],
    });
    expect(nextProject.targetGrade).toBe(1);
    expect(firstProject.targetGrade).toBe(0);
  });

  it('does not apply an old project dialog selection after the project input changes', () => {
    fixture.componentRef.setInput(
      'project',
      buildProjectWithTasks([{dueDate: new Date(2026, 8, 15)}]),
    );
    fixture.detectChanges();
    const closed: Subject<DownloadFilterSelection> = new Subject();
    matDialogStub.open.mockReturnValue({afterClosed: () => closed});
    component.openDownloadDialog();

    fixture.componentRef.setInput(
      'project',
      buildProjectWithTasks([{dueDate: new Date(2026, 8, 20)}], 1),
    );
    fixture.detectChanges();
    closed.next({grade: 3, direction: 'andAbove', excludeCompleted: false});
    closed.complete();

    expect(fileDownloaderStub.downloadBlobToFileWithFeedback).not.toHaveBeenCalled();
    expect(component.selectedDownloadGrade).toBe(1);
    expect(component.downloadDirection).toBe('upTo');
    expect(component.excludeCompleted).toBe(true);
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

  it('hasDownloadableTasks reflects whether any tasks are loaded, regardless of the filter selection', () => {
    // The filter selection now lives in the dialog, opened after this gate. A selection that
    // would yield zero results (e.g. grade 0 with a grade-2 task) is guarded inside the dialog
    // instead, so this gate must stay true as long as the project has any tasks at all.
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), targetGrade: 2},
    ]);
    fixture.detectChanges();

    component.selectedDownloadGrade = 0;
    expect(component.hasDownloadableTasks).toBe(true);

    component.excludeCompleted = true;
    expect(component.hasDownloadableTasks).toBe(true);
  });

  it('includes the selected grade abbreviation in the filename, not the default', () => {
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), targetGrade: 0},
    ]);
    fixture.detectChanges();
    component.selectedDownloadGrade = 1; // Credit, abbreviation 'C'.
    // Pinned false so this test's filename expectation is decoupled from the excludeCompleted
    // default (true) - this test is about the grade override portion of the filename only.
    component.excludeCompleted = false;

    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');

    component.downloadIcs();

    expect(fileDownloaderStub.downloadBlobToFileWithFeedback).toHaveBeenCalledWith(
      'blob:mock-url',
      'COS10001-tasks-C.ics',
    );
  });

  it('excludes tasks in a final state from the generated calendar when excludeCompleted is on', () => {
    // Task 1 is complete (a final status), Task 2 is still in progress. If the completed
    // filter were ignored, both event UIDs would be present in the generated calendar.
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), status: 'complete'},
      {dueDate: new Date(2026, 8, 20, 23, 59, 59, 999), status: 'working_on_it'},
    ]);
    fixture.detectChanges();
    component.excludeCompleted = true;

    const ics = buildIcsCalendar(component['tasksForDownload'](), new Date('2026-08-24T00:00:00Z'));
    expect(ics).not.toContain('UID:E-1');
    expect(ics).toContain('UID:E-2');
  });

  it('includes both completed and outstanding tasks when excludeCompleted is unticked', () => {
    // CAL-F09 flipped the default to true (see the excludeCompleted field). This test now
    // covers the unticked path explicitly rather than relying on it being the default.
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), status: 'complete'},
      {dueDate: new Date(2026, 8, 20, 23, 59, 59, 999), status: 'working_on_it'},
    ]);
    fixture.detectChanges();
    component.excludeCompleted = false;

    const ics = buildIcsCalendar(component['tasksForDownload'](), new Date('2026-08-24T00:00:00Z'));
    expect(ics).toContain('UID:E-1');
    expect(ics).toContain('UID:E-2');
  });

  it('defaults excludeCompleted to true, so an untouched download excludes completed tasks and carries the -outstanding suffix', async () => {
    // Discriminating for the CAL-F09 default flip: if excludeCompleted silently reverted to
    // false, the boolean check below would fail, the completed task's UID would leak into the
    // ICS output, and the filename would lose its -outstanding suffix.
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), status: 'complete'},
      {dueDate: new Date(2026, 8, 20, 23, 59, 59, 999), status: 'working_on_it'},
    ]);
    fixture.detectChanges();

    expect(component.excludeCompleted).toBe(true);

    const ics = buildIcsCalendar(component['tasksForDownload'](), new Date('2026-08-24T00:00:00Z'));
    expect(ics).not.toContain('UID:E-1');
    expect(ics).toContain('UID:E-2');

    const createObjectURLSpy = vi
      .spyOn(window.URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url');
    component.downloadIcs();
    expect(fileDownloaderStub.downloadBlobToFileWithFeedback).toHaveBeenCalledWith(
      'blob:mock-url',
      'COS10001-tasks-P-outstanding.ics',
    );

    // Read the file the download actually built, so a downloadIcs() that skipped the
    // completed filter would fail here even though the helper above is still correct.
    const [blobArg] = createObjectURLSpy.mock.calls[0];
    const downloaded = await (blobArg as Blob).text();
    expect(downloaded).not.toContain('UID:E-1');
    expect(downloaded).toContain('UID:E-2');
  });

  it('composes the completed filter with the grade filter', () => {
    // Task 1: grade 0, complete. Task 2: grade 2, outstanding. Task 3: grade 0, outstanding.
    // With selectedDownloadGrade 0 and excludeCompleted true, only Task 3 should remain.
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), targetGrade: 0, status: 'complete'},
      {dueDate: new Date(2026, 8, 20, 23, 59, 59, 999), targetGrade: 2, status: 'working_on_it'},
      {dueDate: new Date(2026, 8, 22, 23, 59, 59, 999), targetGrade: 0, status: 'working_on_it'},
    ]);
    fixture.detectChanges();
    component.selectedDownloadGrade = 0;
    component.excludeCompleted = true;

    const tasks = component['tasksForDownload']();
    expect(tasks.map((task) => task.definition.id)).toEqual([3]);
  });

  it('this grade and above with HD selected yields only targetGrade 3 tasks', () => {
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), targetGrade: 0},
      {dueDate: new Date(2026, 8, 20, 23, 59, 59, 999), targetGrade: 2},
      {dueDate: new Date(2026, 8, 22, 23, 59, 59, 999), targetGrade: 3},
    ]);
    fixture.detectChanges();
    component.selectedDownloadGrade = 3;
    component.downloadDirection = 'andAbove';

    const tasks = component['tasksForSelectedGrade']();
    expect(tasks.map((task) => task.definition.id)).toEqual([3]);
  });

  it('this grade and above with Distinction selected yields targetGrade 2 and 3 only, excluding a Pass task', () => {
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), targetGrade: 0},
      {dueDate: new Date(2026, 8, 20, 23, 59, 59, 999), targetGrade: 2},
      {dueDate: new Date(2026, 8, 22, 23, 59, 59, 999), targetGrade: 3},
    ]);
    fixture.detectChanges();
    component.selectedDownloadGrade = 2;
    component.downloadDirection = 'andAbove';

    const tasks = component['tasksForSelectedGrade']();
    expect(tasks.map((task) => task.definition.id)).toEqual([2, 3]);
    expect(tasks.map((task) => task.definition.id)).not.toContain(1);
  });

  it('composes this grade and above with exclude-completed', () => {
    // Task 1: grade 0, complete. Task 2: grade 2, outstanding. Task 3: grade 3, complete.
    // Task 4: grade 3, outstanding. With direction andAbove, selectedDownloadGrade 2 and
    // excludeCompleted true, only Task 2 and Task 4 should remain.
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), targetGrade: 0, status: 'complete'},
      {dueDate: new Date(2026, 8, 20, 23, 59, 59, 999), targetGrade: 2, status: 'working_on_it'},
      {dueDate: new Date(2026, 8, 22, 23, 59, 59, 999), targetGrade: 3, status: 'complete'},
      {dueDate: new Date(2026, 8, 23, 23, 59, 59, 999), targetGrade: 3, status: 'working_on_it'},
    ]);
    fixture.detectChanges();
    component.selectedDownloadGrade = 2;
    component.downloadDirection = 'andAbove';
    component.excludeCompleted = true;

    const tasks = component['tasksForDownload']();
    expect(tasks.map((task) => task.definition.id)).toEqual([2, 4]);
  });

  it.each([0, 1, 2, 3])('exports exactly the tasks up to grade %i', async (grade) => {
    component.project = buildProjectWithTasks(
      [0, 1, 2, 3].map((targetGrade) => ({targetGrade, dueDate: new Date(2026, 8, 20)})),
    );
    fixture.detectChanges();
    component.selectedDownloadGrade = grade;
    const createUrl = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:grade');

    component.downloadIcs();

    const calendar = await (createUrl.mock.calls[0][0] as Blob).text();
    expect(calendar.match(/^UID:.+$/gm)?.map((uid) => uid.trim())).toEqual(
      [0, 1, 2, 3].filter((value) => value <= grade).map((value) => `UID:E-${value + 1}`),
    );
    expect(component.project.targetGrade).toBe(0);
  });

  it.each([0, 1, 2, 3])('exports exactly the tasks from grade %i and above', async (grade) => {
    component.project = buildProjectWithTasks(
      [0, 1, 2, 3].map((targetGrade) => ({targetGrade, dueDate: new Date(2026, 8, 20)})),
    );
    fixture.detectChanges();
    component.selectedDownloadGrade = grade;
    component.downloadDirection = 'andAbove';
    const createUrl = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:grade');

    component.downloadIcs();

    const calendar = await (createUrl.mock.calls[0][0] as Blob).text();
    expect(calendar.match(/^UID:.+$/gm)?.map((uid) => uid.trim())).toEqual(
      [0, 1, 2, 3].filter((value) => value >= grade).map((value) => `UID:E-${value + 1}`),
    );
  });

  it('excludes every submitted/final state but keeps work that needs resubmission', () => {
    component.project = buildProjectWithTasks(
      TaskStatus.STATUS_KEYS.map((status) => ({status, dueDate: new Date(2026, 8, 20)})),
    );
    fixture.detectChanges();

    expect(component['tasksForDownload']().map((task) => task.status)).toEqual([
      'not_started',
      'redo',
      'need_help',
      'working_on_it',
      'fix_and_resubmit',
    ]);
    component.excludeCompleted = false;
    expect(component['tasksForDownload']().map((task) => task.status)).toEqual(
      TaskStatus.STATUS_KEYS,
    );
  });

  it('counts only resolvable dates and blocks a file when the selection has none', () => {
    component.project = buildProjectWithTasks([
      {targetGrade: 0},
      {targetGrade: 0, dueDate: new Date('invalid')},
      {targetGrade: 2, dueDate: new Date(2026, 8, 20)},
    ]);
    fixture.detectChanges();
    matDialogStub.open.mockReturnValue({afterClosed: () => of(undefined)});

    component.openDownloadDialog();

    const options = matDialogStub.open.mock.calls[0][1];
    expect(options.autoFocus).toBe('first-tabbable');
    expect(options.data.matchingTaskCount(0, 'upTo', true)).toBe(0);
    expect(options.data.matchingTaskCount(2, 'upTo', true)).toBe(1);
    component.downloadIcs();
    expect(fileDownloaderStub.downloadBlobToFileWithFeedback).not.toHaveBeenCalled();
  });

  it('inserts -and-above into the filename for the and-above direction, leaving up-to filenames unchanged', () => {
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), targetGrade: 2},
    ]);
    fixture.detectChanges();
    component.selectedDownloadGrade = 2;
    // Pinned false so the filenames below isolate the direction suffix from the
    // excludeCompleted default (true), which appends its own suffix.
    component.excludeCompleted = false;

    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');

    component.downloadDirection = 'upTo';
    component.downloadIcs();
    expect(fileDownloaderStub.downloadBlobToFileWithFeedback).toHaveBeenCalledWith(
      'blob:mock-url',
      'COS10001-tasks-D.ics',
    );

    fileDownloaderStub.downloadBlobToFileWithFeedback.mockClear();
    component.downloadDirection = 'andAbove';
    component.downloadIcs();
    expect(fileDownloaderStub.downloadBlobToFileWithFeedback).toHaveBeenCalledWith(
      'blob:mock-url',
      'COS10001-tasks-D-and-above.ics',
    );
  });

  it('applies the values returned by the download dialog and downloads accordingly', () => {
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), targetGrade: 3},
    ]);
    fixture.detectChanges();

    const selection: DownloadFilterSelection = {
      grade: 3,
      direction: 'andAbove',
      excludeCompleted: false,
    };
    matDialogStub.open.mockReturnValue({afterClosed: () => of(selection)});
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');

    component.openDownloadDialog();

    expect(matDialogStub.open).toHaveBeenCalledOnce();
    expect(component.selectedDownloadGrade).toBe(3);
    expect(component.downloadDirection).toBe('andAbove');
    expect(fileDownloaderStub.downloadBlobToFileWithFeedback).toHaveBeenCalledWith(
      'blob:mock-url',
      'COS10001-tasks-HD-and-above.ics',
    );
  });

  it('does not download when the dialog is cancelled', () => {
    // If afterClosed's result were ignored (or a cancel treated as a selection), this would
    // still call the file downloader.
    component.project = buildProjectWithTasks([{dueDate: new Date(2026, 8, 15, 23, 59, 59, 999)}]);
    fixture.detectChanges();

    matDialogStub.open.mockReturnValue({afterClosed: () => of(undefined)});

    component.openDownloadDialog();

    expect(fileDownloaderStub.downloadBlobToFileWithFeedback).not.toHaveBeenCalled();
  });

  it('appends -outstanding to the filename when excludeCompleted is on', () => {
    component.project = buildProjectWithTasks([
      {dueDate: new Date(2026, 8, 15, 23, 59, 59, 999), status: 'working_on_it'},
    ]);
    fixture.detectChanges();
    component.excludeCompleted = true;

    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');

    component.downloadIcs();

    expect(fileDownloaderStub.downloadBlobToFileWithFeedback).toHaveBeenCalledWith(
      'blob:mock-url',
      'COS10001-tasks-P-outstanding.ics',
    );
  });
});
