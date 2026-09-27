import {beforeEach, describe, expect, it} from 'vitest';
/* eslint-disable @angular-eslint/component-max-inline-declarations */
import {CommonModule} from '@angular/common';
import {Component, Input, NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {of} from 'rxjs';
import {Project} from 'src/app/api/models/project';
import {PortfolioStateComponent} from './portfolio-state.component';

@Component({selector: 'f-portfolio-welcome-step', template: '', standalone: false})
class PortfolioWelcomeStepStubComponent {
  @Input() onAdvanceActiveTab: (advanceBy: 1 | -1) => void;
}

@Component({selector: 'f-portfolio-grade-select-step', template: '', standalone: false})
class PortfolioGradeStepStubComponent {
  @Input() onAdvanceActiveTab: (advanceBy: 1 | -1) => void;
  @Input() project: Project;
  @Input() unit: unknown;
}

@Component({selector: 'f-portfolio-learning-summary-report-step', template: '', standalone: false})
class PortfolioSummaryStepStubComponent extends PortfolioGradeStepStubComponent {}

@Component({selector: 'f-portfolio-add-extra-files-step', template: '', standalone: false})
class PortfolioExtraFilesStepStubComponent {
  @Input() onAdvanceActiveTab: (advanceBy: 1 | -1) => void;
  @Input() project: Project;
}

@Component({selector: 'f-portfolio-review-step', template: '', standalone: false})
class PortfolioReviewStepStubComponent extends PortfolioGradeStepStubComponent {}

describe('PortfolioStateComponent mobile step contract', () => {
  let fixture: ComponentFixture<PortfolioStateComponent>;
  let component: PortfolioStateComponent;
  let project: Project;

  beforeEach(async () => {
    project = {
      id: 17,
      unit: {id: 7},
      submittedGrade: null,
      usesDraftLearningSummary: false,
      portfolioFiles: [],
      portfolioAvailable: false,
      compilePortfolio: false,
    } as unknown as Project;

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [
        PortfolioStateComponent,
        PortfolioWelcomeStepStubComponent,
        PortfolioGradeStepStubComponent,
        PortfolioSummaryStepStubComponent,
        PortfolioExtraFilesStepStubComponent,
        PortfolioReviewStepStubComponent,
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {parent: {snapshot: {data: {project}}}},
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PortfolioStateComponent);
    component = fixture.componentInstance;
    component.project$ = of(project);
    fixture.detectChanges();
  });

  it('renders an unclipped current-step summary with labelled 44px navigation controls', () => {
    const stepper = fixture.nativeElement.querySelector(
      'nav[aria-label="Portfolio steps"]',
    ) as HTMLElement;
    const previous = stepper.querySelector(
      'button[aria-label="Previous portfolio step"]',
    ) as HTMLButtonElement;
    const next = stepper.querySelector(
      'button[aria-label="Next portfolio step"]',
    ) as HTMLButtonElement;

    expect(stepper.textContent).toContain('Step 1 of 5');
    expect(stepper.textContent).toContain('Overview');
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
  });

  it('does not let the mobile stepper skip locked portfolio requirements', () => {
    component.setActiveTab(component.tabs.gradeStep);
    fixture.detectChanges();

    const next = fixture.nativeElement.querySelector(
      'button[aria-label="Next portfolio step"]',
    ) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    component.advanceActiveTab(1);
    expect(component.activeTab).toBe(component.tabs.gradeStep);

    project.submittedGrade = 2;
    fixture.detectChanges();
    expect(next.disabled).toBe(false);

    component.advanceActiveTab(1);
    expect(component.activeTab).toBe(component.tabs.summaryStep);
  });

  it('recognises a draft learning summary and opens the next preparation step', () => {
    project.submittedGrade = 2;
    project.usesDraftLearningSummary = true;

    component.ngOnDestroy();
    component.project$ = of(project);
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.hasLearningSummaryReport).toBe(true);
    expect(component.activeTab).toBe(component.tabs.summaryStep);
  });
});
