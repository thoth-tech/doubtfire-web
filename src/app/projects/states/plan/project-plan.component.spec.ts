import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import {MatSelectHarness} from '@angular/material/select/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {ActivatedRoute} from '@angular/router';
import {of} from 'rxjs';
import {Project} from 'src/app/api/models/project';
import {ProjectService} from 'src/app/api/services/project.service';
import {UserService} from 'src/app/api/services/user.service';
import {CalendarModalService} from 'src/app/common/modals/calendar-modal/calendar-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {ProjectPlanComponent} from './project-plan.component';

describe('ProjectPlanComponent', () => {
  let component: ProjectPlanComponent;
  let fixture: ComponentFixture<ProjectPlanComponent>;
  let project: Project;

  const buildProject = (myRole: string, studentId: number): Project =>
    ({
      id: 18,
      targetGrade: 0,
      student: {id: studentId},
      unit: {
        myRole,
        allowFlexibleDates: false,
        gradeDefinitions: [
          {value: 0, label: 'Pass', abbreviation: 'P'},
          {value: 1, label: 'Credit', abbreviation: 'C'},
        ],
      },
    }) as unknown as Project;

  const createComponent = async (currentProject: Project) => {
    project = currentProject;

    await TestBed.configureTestingModule({
      declarations: [ProjectPlanComponent],
      imports: [FormsModule, MatFormFieldModule, MatSelectModule, NoopAnimationsModule],
      providers: [
        {
          provide: GradeService,
          useValue: {
            gradeValuesFor: () => [0, 1],
            gradeLabel: (grade: number) => (grade === 0 ? 'Pass' : 'Credit'),
          },
        },
        {provide: ProjectService, useValue: {update: vi.fn()}},
        {provide: AlertService, useValue: {success: vi.fn(), error: vi.fn()}},
        {provide: CalendarModalService, useValue: {show: vi.fn()}},
        {provide: UserService, useValue: {currentUser: {id: 25}}},
        {provide: ActivatedRoute, useValue: {parent: null}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectPlanComponent);
    component = fixture.componentInstance;
    component.project$ = of(project);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  const targetGradeSelect = () =>
    TestbedHarnessEnvironment.loader(fixture).getHarness(
      MatSelectHarness.with({selector: '[aria-label="Target grade"]'}),
    );

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('lets a student change their own target grade', async () => {
    await createComponent(buildProject('Student', 25));

    expect(component.viewingOtherStudentProject).toBe(false);
    expect(await (await targetGradeSelect()).isDisabled()).toBe(false);
  });

  it('locks the selector when staff are viewing another student project', async () => {
    await createComponent(buildProject('Tutor', 99));

    expect(component.viewingOtherStudentProject).toBe(true);
    expect(await (await targetGradeSelect()).isDisabled()).toBe(true);
  });
});
