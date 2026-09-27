import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatButtonHarness} from '@angular/material/button/testing';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatCheckboxHarness} from '@angular/material/checkbox/testing';
import {MatRadioModule} from '@angular/material/radio';
import {MatRadioGroupHarness} from '@angular/material/radio/testing';
import {Observable, Subject, of} from 'rxjs';
import {Project, Unit} from 'src/app/api/models/doubtfire-model';
import {ProjectService} from 'src/app/api/services/project.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {PortfolioGradeSelectStepComponent} from './portfolio-grade-select-step.component';

describe('PortfolioGradeSelectStepComponent', () => {
  let fixture: ComponentFixture<PortfolioGradeSelectStepComponent>;
  let project: {submittedGrade: number | null; refreshBurndownChartData: () => void};
  let update: ReturnType<typeof vi.fn<(project: Project) => Observable<Project>>>;
  let alertError: ReturnType<typeof vi.fn<(message: string, duration: number) => void>>;
  let advance: ReturnType<typeof vi.fn<(index: 1 | -1) => void>>;

  beforeEach(async () => {
    project = {submittedGrade: null, refreshBurndownChartData: vi.fn()};
    update = vi.fn<(project: Project) => Observable<Project>>(() =>
      of(project as unknown as Project),
    );
    alertError = vi.fn<(message: string, duration: number) => void>();
    advance = vi.fn<(index: 1 | -1) => void>();

    await TestBed.configureTestingModule({
      declarations: [PortfolioGradeSelectStepComponent],
      imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatRadioModule],
      providers: [
        {provide: ProjectService, useValue: {update}},
        {provide: AlertService, useValue: {error: alertError}},
      ],
      // f-grade-icon and mat-icon are not under test here.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PortfolioGradeSelectStepComponent);
    fixture.componentInstance.project = project as unknown as Project;
    fixture.componentInstance.unit = {code: 'DEMO101', name: 'Demo'} as unknown as Unit;
    fixture.componentInstance.onAdvanceActiveTab = advance;
    fixture.detectChanges();
  });

  async function nextButton(): Promise<MatButtonHarness> {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    return loader.getHarness(MatButtonHarness.with({text: 'Next'}));
  }

  it('hides the grades and keeps Next off until the criteria box is ticked', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);

    expect(await loader.hasHarness(MatRadioGroupHarness)).toBe(false);
    expect(await (await nextButton()).isDisabled()).toBe(true);

    await (await loader.getHarness(MatCheckboxHarness)).check();

    expect(await loader.hasHarness(MatRadioGroupHarness)).toBe(true);
    // Ticked but no grade yet, so Next stays off.
    expect(await (await nextButton()).isDisabled()).toBe(true);
  });

  it('saves the chosen grade and turns Next on', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    await (await loader.getHarness(MatCheckboxHarness)).check();

    const grades = await loader.getHarness(MatRadioGroupHarness);
    const buttons = await grades.getRadioButtons();
    expect(buttons.length).toBe(4);
    expect(await buttons[2].getLabelText()).toBe('Distinction');

    await buttons[2].check();

    expect(update).toHaveBeenCalledTimes(1);
    expect(project.submittedGrade).toBe(2);
    expect(await (await nextButton()).isDisabled()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(
      'all the unit learning outcomes at Distinction level',
    );

    await (await nextButton()).click();
    expect(advance).toHaveBeenCalledWith(1);
  });

  it('puts the previous grade back when the save fails', async () => {
    project.submittedGrade = 1;
    // A real request fails later, after the new grade has already rendered.
    const response: Subject<Project> = new Subject();
    update.mockReturnValueOnce(response);
    const loader = TestbedHarnessEnvironment.loader(fixture);
    await (await loader.getHarness(MatCheckboxHarness)).check();

    const grades = await loader.getHarness(MatRadioGroupHarness);
    await (await grades.getRadioButtons())[3].check();
    expect(project.submittedGrade).toBe(3);

    response.error('offline');
    fixture.detectChanges();

    expect(project.submittedGrade).toBe(1);
    expect(await grades.getCheckedValue()).toBe('1');
    expect(alertError).toHaveBeenCalledWith('Could not update grade: offline', 6000);
  });

  it('goes back a step from Back', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    await (await loader.getHarness(MatButtonHarness.with({text: 'Back'}))).click();

    expect(advance).toHaveBeenCalledWith(-1);
  });
});
