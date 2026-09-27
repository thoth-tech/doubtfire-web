import {beforeEach, describe, expect, it} from 'vitest';
import {CommonModule} from '@angular/common';
import {Component, Input, NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {Project} from 'src/app/api/models/project';
import {GlobalStateService} from '../index/global-state.service';
import {PortfolioStateComponent} from './portfolio-state.component';

interface ProjectStub {
  submittedGrade: number | null;
  usesDraftLearningSummary: boolean;
  portfolioFiles: {idx: number; kind: string; name: string}[];
  portfolioAvailable: boolean;
  compilePortfolio: boolean;
  unit: object;
}

function projectStub(overrides: Partial<ProjectStub> = {}): Project {
  return {
    submittedGrade: null,
    usesDraftLearningSummary: false,
    portfolioFiles: [],
    portfolioAvailable: false,
    compilePortfolio: false,
    unit: {},
    ...overrides,
  } as unknown as Project;
}

// The steps take a callback input named on..., which Angular refuses to bind on an
// unknown element, so each step is stubbed with the inputs the page passes it.
abstract class StepStub {
  @Input() onAdvanceActiveTab?: (index: 1 | -1) => void;
  @Input() project?: Project;
  @Input() unit?: unknown;
}

@Component({
  selector: 'f-portfolio-welcome-step',
  templateUrl: './portfolio-step-stub.spec.html',
  standalone: false,
})
class WelcomeStepStub extends StepStub {}

@Component({
  selector: 'f-portfolio-grade-select-step',
  templateUrl: './portfolio-step-stub.spec.html',
  standalone: false,
})
class GradeStepStub extends StepStub {}

@Component({
  selector: 'f-portfolio-learning-summary-report-step',
  templateUrl: './portfolio-step-stub.spec.html',
  standalone: false,
})
class SummaryStepStub extends StepStub {}

@Component({
  selector: 'f-portfolio-add-extra-files-step',
  templateUrl: './portfolio-step-stub.spec.html',
  standalone: false,
})
class OtherFilesStepStub extends StepStub {}

@Component({
  selector: 'f-portfolio-review-step',
  templateUrl: './portfolio-step-stub.spec.html',
  standalone: false,
})
class ReviewStepStub extends StepStub {}

describe('PortfolioStateComponent', () => {
  let fixture: ComponentFixture<PortfolioStateComponent>;
  let component: PortfolioStateComponent;

  async function render(project: Project): Promise<void> {
    await TestBed.configureTestingModule({
      declarations: [
        PortfolioStateComponent,
        WelcomeStepStub,
        GradeStepStub,
        SummaryStepStub,
        OtherFilesStepStub,
        ReviewStepStub,
      ],
      imports: [CommonModule],
      providers: [
        {provide: GlobalStateService, useValue: {}},
        {provide: ActivatedRoute, useValue: {parent: {snapshot: {data: {project}}}}},
      ],
      // f-page-container and mat-icon are not under test here.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PortfolioStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function stepButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('nav .portfolio-step'));
  }

  // The state modifier class on each step button, in order.
  function stepClasses(): (string | undefined)[] {
    return stepButtons().map((button) =>
      Array.from(button.classList)
        .find((name) => name.startsWith('portfolio-step--'))
        ?.replace('portfolio-step--', ''),
    );
  }

  function currentStepLabel(): string | undefined {
    return stepButtons()
      .find((button) => button.getAttribute('aria-current') === 'step')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows all five steps and opens on the overview for a new portfolio', async () => {
    await render(projectStub());

    expect(stepButtons().length).toBe(5);
    expect(currentStepLabel()).toContain('Step 1: Overview');
    expect(fixture.nativeElement.querySelector('f-portfolio-welcome-step')).not.toBeNull();
  });

  it('locks the steps after the grade until a grade is chosen, and ignores clicks on them', async () => {
    await render(projectStub());

    const disabled = stepButtons().map((button) => button.disabled);
    expect(disabled).toEqual([false, false, true, true, true]);
    expect(component.stepState(component.tabs.summaryStep)).toBe('locked');
    expect(stepClasses()).toEqual(['current', 'open', 'locked', 'locked', 'locked']);

    component.onSelectedTabIndexChange(2);
    fixture.detectChanges();

    expect(component.activeTab).toBe(component.tabs.welcomeStep);
  });

  it('marks the grade done and opens the report step once a grade is saved', async () => {
    await render(projectStub({submittedGrade: 2}));

    expect(component.stepState(component.tabs.gradeStep)).toBe('done');
    expect(component.stepState(component.tabs.summaryStep)).toBe('open');
    expect(stepButtons().map((button) => button.disabled)).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
    expect(stepButtons()[1].querySelector('mat-icon')?.textContent).toBe('check');
    expect(stepClasses()).toEqual(['current', 'done', 'open', 'locked', 'locked']);
  });

  it('keeps finished steps ticked but locked while the portfolio compiles', async () => {
    await render(
      projectStub({
        submittedGrade: 2,
        portfolioFiles: [{idx: 0, kind: 'document', name: 'LearningSummaryReport'}],
        compilePortfolio: true,
      }),
    );

    expect(currentStepLabel()).toContain('Step 5: Review and create');
    expect(component.stepState(component.tabs.gradeStep)).toBe('done');
    expect(component.stepState(component.tabs.summaryStep)).toBe('done');
    expect(stepButtons().map((button) => button.disabled)).toEqual([true, true, true, true, false]);
    expect(stepClasses()).toEqual(['done', 'done', 'done', 'done', 'current']);
  });

  it('moves to the next step and focuses the step panel when Next is used', async () => {
    await render(projectStub());

    component.advanceActiveTab(1);
    fixture.detectChanges();
    await fixture.whenStable();

    const panel: HTMLElement = fixture.nativeElement.querySelector('[role="region"]');
    expect(component.activeTab).toBe(component.tabs.gradeStep);
    expect(currentStepLabel()).toContain('Step 2: Choose your grade');
    expect(panel.getAttribute('aria-label')).toBe('Step 2 of 5: Choose your grade');
    expect(document.activeElement).toBe(panel);
  });

  it('opens a step when its unlocked button is clicked', async () => {
    await render(projectStub({submittedGrade: 1}));

    stepButtons()[2].click();
    fixture.detectChanges();

    expect(component.activeTab).toBe(component.tabs.summaryStep);
    expect(
      fixture.nativeElement.querySelector('f-portfolio-learning-summary-report-step'),
    ).not.toBeNull();
  });
});
