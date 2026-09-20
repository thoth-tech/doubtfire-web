import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {NO_ERRORS_SCHEMA, SimpleChange} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import {MatSelectHarness} from '@angular/material/select/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {of, throwError} from 'rxjs';
import {Project} from 'src/app/api/models/project';
import {PeerProgressIndicatorService} from 'src/app/api/services/peer-progress-indicator.service';
import {ProjectService} from 'src/app/api/services/project.service';
import {UserService} from 'src/app/api/services/user.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {ProgressDashboardComponent} from './progress-dashboard.component';

describe('ProgressDashboardComponent', () => {
  let component: ProgressDashboardComponent;
  let fixture: ComponentFixture<ProgressDashboardComponent>;
  let project: Project;
  let projectServiceUpdate: ReturnType<typeof vi.fn>;
  let alertSuccess: ReturnType<typeof vi.fn>;
  let alertError: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    project = {
      id: 18,
      targetGrade: 0,
      unit: {
        myRole: 'Student',
        gradeDefinitions: [
          {value: 0, label: 'Pass'},
          {value: 1, label: 'Credit'},
        ],
      },
      activeTasks: vi
        .fn()
        .mockReturnValue([{status: 'complete'}, {status: 'not_started'}, {status: 'not_started'}]),
      refreshBurndownChartData: vi.fn(),
    } as unknown as Project;

    projectServiceUpdate = vi.fn().mockReturnValue(of(project));
    alertSuccess = vi.fn();
    alertError = vi.fn();

    await TestBed.configureTestingModule({
      declarations: [ProgressDashboardComponent],
      imports: [MatCardModule, MatFormFieldModule, MatSelectModule, NoopAnimationsModule],
      providers: [
        {
          provide: GradeService,
          useValue: {
            grades: {0: 'Pass', 1: 'Credit'},
            gradeValues: [0, 1],
            gradeValuesFor: () => [0, 1],
          },
        },
        {
          provide: PeerProgressIndicatorService,
          useValue: {getDemoUnitSummary: vi.fn().mockReturnValue(of(null))},
        },
        {provide: DemoModeStore, useValue: {enabled: true}},
        {provide: ProjectService, useValue: {update: projectServiceUpdate}},
        {provide: AlertService, useValue: {success: alertSuccess, error: alertError}},
        {provide: UserService, useValue: {currentUser: {id: 25}}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProgressDashboardComponent);
    component = fixture.componentInstance;
    component.project = project;
    fixture.detectChanges();
    await fixture.whenStable();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lets the student select a target grade directly from the dashboard', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const select = await loader.getHarness(
      MatSelectHarness.with({selector: '[aria-label="Target grade"]'}),
    );

    expect(await select.isDisabled()).toBe(false);
    expect(await select.getValueText()).toBe('Pass');

    await select.open();
    await select.clickOptions({text: 'Credit'});

    expect(project.targetGrade).toBe(1);
    expect(projectServiceUpdate).toHaveBeenCalledWith(project);
    expect(alertSuccess).toHaveBeenCalledWith('Updated target grade successfully', 2000);
    expect(component.numberOfTasks).toEqual({completed: 1, remaining: 2});
  });

  it('locks the selector when staff are viewing another student project', async () => {
    project.unit.myRole = 'Tutor';
    project.student = {id: 99} as Project['student'];
    fixture.detectChanges();
    await fixture.whenStable();

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const select = await loader.getHarness(
      MatSelectHarness.with({selector: '[aria-label="Target grade"]'}),
    );

    expect(component.viewingOtherStudentProject).toBe(true);
    expect(await select.isDisabled()).toBe(true);
  });

  it('restores the previous target grade when the update fails', () => {
    projectServiceUpdate.mockReturnValueOnce(throwError(() => new Error('update failed')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    component.updateTargetGrade(1);

    expect(project.targetGrade).toBe(0);
    expect(component.isUpdatingTargetGrade).toBe(false);
    expect(alertError).toHaveBeenCalledWith('Failed to update target grade', 4000);
  });

  it('uses the target-scoped task collection for completion totals', () => {
    component.ngOnInit();

    expect(component.numberOfTasks).toEqual({completed: 1, remaining: 2});
  });

  it('does not cap or clip the burndown and status cards', () => {
    const host = fixture.nativeElement as HTMLElement;
    const cardTitles = Array.from(host.querySelectorAll<HTMLElement>('mat-card-title'));
    const burndownCard = cardTitles
      .find((title) => title.textContent.trim() === 'Progress Burndown')
      ?.closest('mat-card') as HTMLElement;
    const statusCard = cardTitles
      .find((title) => title.textContent.trim() === 'Task Statuses')
      ?.closest('mat-card') as HTMLElement;
    const burndownContent = burndownCard?.querySelector('mat-card-content') as HTMLElement;

    // jsdom loads no stylesheets and lays nothing out, so every element measures 0 high
    // and a utility class never reaches getComputedStyle. The computed pair catches a cap
    // set inline or in the component styles, and the class scan covers the utility route
    // the regression actually took, for any height cap rather than the one literal value.
    const clipping = (element: HTMLElement) => {
      const computed = getComputedStyle(element);
      return {
        maxHeight: computed.maxHeight,
        overflowY: computed.overflowY,
        clippingClasses: Array.from(element.classList).filter((name) =>
          /^max-h-|^overflow-(y-)?hidden$/.test(name),
        ),
      };
    };
    const uncapped = {maxHeight: 'none', overflowY: 'visible', clippingClasses: []};

    expect(burndownCard).toBeTruthy();
    expect(statusCard).toBeTruthy();
    expect(burndownContent).toBeTruthy();
    expect(clipping(burndownCard)).toEqual(uncapped);
    expect(clipping(statusCard)).toEqual(uncapped);
    expect(clipping(burndownContent)).toEqual(uncapped);
  });

  it('renders fabricated unit peer progress only while demo mode is enabled', () => {
    expect(fixture.nativeElement.querySelector('f-peer-progress-unit-summary')).toBeTruthy();

    (component.demoMode as {enabled: boolean}).enabled = false;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('f-peer-progress-unit-summary')).toBeNull();
  });
});

describe('ProgressDashboardComponent route reuse', () => {
  it('refreshes summary data when the active project changes', () => {
    const gradeValuesFor = vi.fn(() => [0]);
    const component = new ProgressDashboardComponent(
      {
        grades: {0: 'Pass'},
        gradeValues: [0],
        gradeValuesFor,
      } as unknown as GradeService,
      {
        getDemoUnitSummary: vi.fn().mockReturnValue(of(null)),
      } as unknown as PeerProgressIndicatorService,
      {} as ProjectService,
      {} as AlertService,
      {} as UserService,
      {enabled: true} as DemoModeStore,
    );
    const firstProject = {
      id: 2,
      targetGrade: 0,
      unit: {gradeDefinitions: [{value: 0, label: 'Pass'}]},
      numberTasks: vi.fn(() => 1),
      activeTasks: vi.fn(() => [{}, {}, {}]),
      refreshBurndownChartData: vi.fn(),
    } as unknown as Project;
    const nextProject = {
      id: 18,
      targetGrade: 0,
      unit: {gradeDefinitions: [{value: 0, label: 'Pass'}]},
      numberTasks: vi.fn(() => 2),
      activeTasks: vi.fn(() => [
        {status: 'complete'},
        {status: 'complete'},
        {status: 'not_started'},
        {status: 'not_started'},
      ]),
      refreshBurndownChartData: vi.fn(),
    } as unknown as Project;
    component.project = firstProject;
    component.ngOnInit();
    vi.clearAllMocks();

    component.project = nextProject;
    component.ngOnChanges({project: new SimpleChange(firstProject, nextProject, false)});

    expect(gradeValuesFor).toHaveBeenCalledWith(nextProject.unit);
    expect(component.numberOfTasks).toEqual({completed: 2, remaining: 2});
    expect(nextProject.refreshBurndownChartData).toHaveBeenCalled();
  });
});
