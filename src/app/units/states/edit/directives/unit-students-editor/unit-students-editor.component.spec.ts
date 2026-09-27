import {afterEach, describe, expect, it, vi} from 'vitest';
import {HttpClient} from '@angular/common/http';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatMenuModule} from '@angular/material/menu';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatSortModule} from '@angular/material/sort';
import {MatTableModule} from '@angular/material/table';
import {MatTooltipModule} from '@angular/material/tooltip';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Router} from '@angular/router';
import {of, throwError} from 'rxjs';
import {ProjectService} from 'src/app/api/models/doubtfire-model';
import {Unit} from 'src/app/api/models/unit';
import {EmptyStateComponent} from 'src/app/common/empty-state/empty-state.component';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {CsvResultModalService} from 'src/app/common/modals/csv-result-modal/csv-result-modal.service';
import {CsvUploadModalService} from 'src/app/common/modals/csv-upload-modal/csv-upload-modal.service';
import {SidekiqProgressModalService} from 'src/app/common/modals/sidekiq-progress-modal/sidekiq-progress-modal.service';
import {SpecConModalService} from 'src/app/common/modals/spec-con-modal/spec-con-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {UnitStudentEnrolmentModalService} from 'src/app/units/modals/unit-student-enrolment-modal/unit-student-enrolment-modal.service';
import {UnitStudentsEditorComponent} from './unit-students-editor.component';

function project(id: number, firstName: string, lastName: string, extra: object = {}) {
  return {
    id,
    key: id,
    enrolled: true,
    campus: null,
    student: {
      username: `${firstName.toLowerCase()}${id}`,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}@uni.edu`,
      name: `${firstName} ${lastName}`,
    },
    updateUnitEnrolment: vi.fn(),
    matches: () => true,
    ...extra,
  };
}

function editorFor(loadStudents: () => unknown = () => of([])) {
  const unit = Object.assign(new Unit(), {id: 3, code: 'SIT101'});
  const projectService = {loadStudents: vi.fn(loadStudents)};

  const component = new UnitStudentsEditorComponent(
    {} as never, // httpClient
    {} as never, // enrolModal
    {} as never, // alerts
    {} as never, // csvUploadModal
    {} as never, // csvResultModal
    {} as never, // fileDownloader
    {navigate: vi.fn()} as never, // router
    projectService as never,
    {} as never, // specConModalService
    {} as never, // sidekiqProgressModalService
  );
  component.unit = unit;
  return {component, unit, projectService};
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

describe('UnitStudentsEditorComponent', () => {
  // The name and email columns are on the student, not the project, so sorting on
  // them compared undefined and scrambled the list.
  it('sorts on the student details each column shows', () => {
    const {component} = editorFor();
    const zoe = project(1, 'Zoe', 'Adams');
    const amy = project(2, 'amy', 'Young', {enrolled: false, campus: {name: 'Burwood'}});

    expect(component.sortValue(zoe as never, 'firstName')).toBe('zoe');
    expect(component.sortValue(amy as never, 'firstName')).toBe('amy');
    expect(component.sortValue(zoe as never, 'lastName')).toBe('adams');
    expect(component.sortValue(amy as never, 'email')).toBe('amy@uni.edu');
    expect(component.sortValue(amy as never, 'campus')).toBe('burwood');
    expect(component.sortValue(amy as never, 'enrolled')).toBe(0);

    component.ngOnInit();
    component.dataSource.data = [zoe, amy] as never;
    const sorted = component.dataSource.sortData(component.dataSource.data, {
      active: 'firstName',
      direction: 'asc',
    } as never);
    expect(sorted.map((row) => row.id)).toEqual([2, 1]);
  });

  it('saves the enrolment when the box changes', () => {
    const {component} = editorFor();
    const zoe = project(1, 'Zoe', 'Adams');

    component.enrolmentChanged(zoe as never);

    expect(zoe.updateUnitEnrolment).toHaveBeenCalledTimes(1);
  });

  it('says when the students cannot be loaded, and can try again', async () => {
    const {component, projectService} = editorFor(() => throwError(() => 'offline'));

    component.ngOnInit();
    await settle();

    expect(component.loadingStudents).toBe(false);
    expect(component.loadError).toBe(true);

    projectService.loadStudents.mockReturnValue(of([]));
    component.reloadStudents();
    expect(component.loadError).toBe(false);
    await settle();
    expect(component.loadingStudents).toBe(false);
    expect(component.loadError).toBe(false);
    component.ngOnDestroy();
  });

  it('tells a search with no matches apart from an empty unit', () => {
    const {component} = editorFor();
    component.ngOnInit();

    expect(component.filtering).toBe(false);
    component.applyFilter({target: {value: '  Zo '}} as never);
    expect(component.filtering).toBe(true);
    expect(component.dataSource.filter).toBe('zo');
    component.ngOnDestroy();
  });
});

describe('UnitStudentsEditorComponent enrolled box', () => {
  afterEach(() => TestBed.resetTestingModule());

  // The save ran on a click anywhere on the box's element, so a click that did not
  // change the box still sent a save and a success message.
  it('saves when the box changes, and only then', async () => {
    const unit = Object.assign(new Unit(), {id: 3, code: 'SIT101'});
    const zoe = project(1, 'Zoe', 'Adams');
    unit.studentCache.add(zoe as never);

    await TestBed.configureTestingModule({
      declarations: [UnitStudentsEditorComponent],
      imports: [
        FormsModule,
        MatCheckboxModule,
        MatIconModule,
        MatInputModule,
        MatMenuModule,
        MatPaginatorModule,
        MatSortModule,
        MatTableModule,
        MatTooltipModule,
        NoopAnimationsModule,
        EmptyStateComponent,
      ],
      providers: [
        {provide: HttpClient, useValue: {}},
        {provide: UnitStudentEnrolmentModalService, useValue: {}},
        {provide: AlertService, useValue: {}},
        {provide: CsvUploadModalService, useValue: {}},
        {provide: CsvResultModalService, useValue: {}},
        {provide: FileDownloaderService, useValue: {}},
        {provide: Router, useValue: {navigate: vi.fn()}},
        {provide: ProjectService, useValue: {loadStudents: () => of([])}},
        {provide: SpecConModalService, useValue: {}},
        {provide: SidekiqProgressModalService, useValue: {}},
      ],
      // The campus and tutorial pickers have their own specs.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(UnitStudentsEditorComponent);
    fixture.componentInstance.unit = unit;
    fixture.detectChanges();
    // ngModel writes the starting value on the next tick.
    await fixture.whenStable();
    fixture.detectChanges();

    const box: HTMLElement = fixture.nativeElement.querySelector('mat-checkbox');
    expect(box.querySelector('input').getAttribute('aria-label')).toBe('Zoe Adams is enrolled');

    box.click();
    fixture.detectChanges();
    expect(zoe.updateUnitEnrolment).not.toHaveBeenCalled();

    box.querySelector('input').click();
    fixture.detectChanges();
    expect(zoe.updateUnitEnrolment).toHaveBeenCalledTimes(1);
    expect(zoe.enrolled).toBe(false);
    fixture.destroy();
  });
});
