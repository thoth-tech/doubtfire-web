import {beforeEach, describe, expect, it} from 'vitest';
/* eslint-disable @angular-eslint/component-max-inline-declarations */
import {CommonModule} from '@angular/common';
import {Component, Input, NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';
import {GradeService} from 'src/app/common/services/grade.service';
import {PortfolioLearningSummaryReportStepComponent} from './portfolio-learning-summary-report-step.component';

@Component({selector: 'f-file-uploader', template: '', standalone: false})
class FileUploaderStubComponent {
  @Input() files: unknown;
  @Input() onSuccess: (response: unknown) => void;
  @Input() payload: unknown;
  @Input() url: string;
}

describe('PortfolioLearningSummaryReportStepComponent', () => {
  let fixture: ComponentFixture<PortfolioLearningSummaryReportStepComponent>;
  let component: PortfolioLearningSummaryReportStepComponent;
  let project: Project;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [PortfolioLearningSummaryReportStepComponent, FileUploaderStubComponent],
      providers: [{provide: GradeService, useValue: {gradeLabel: () => 'Distinction'}}],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    project = {
      targetGrade: 2,
      usesDraftLearningSummary: false,
      portfolioFiles: [],
      findTaskForDefinition: () => null,
      portfolioUrl: () => '/projects/1/portfolio',
    } as unknown as Project;

    fixture = TestBed.createComponent(PortfolioLearningSummaryReportStepComponent);
    component = fixture.componentInstance;
    component.project = project;
    component.unit = {
      code: 'DEMO20007',
      name: 'Active Learning Studio',
      draftTaskDefinition: null,
    } as Unit;
    fixture.detectChanges();
  });

  it('keeps the missing-report validation above the Back and Next controls', () => {
    const validation = fixture.nativeElement.querySelector(
      '#learning-summary-validation[role="alert"]',
    ) as HTMLElement;
    const actions = fixture.nativeElement.querySelector('.portfolio-step-actions') as HTMLElement;
    const next = actions.querySelector('button[color="primary"]') as HTMLButtonElement;

    expect(validation.textContent).toContain('Upload one to continue');
    expect(validation.nextElementSibling).toBe(actions);
    expect(next.disabled).toBe(true);
    expect(next.getAttribute('aria-describedby')).toBe('learning-summary-validation');
  });

  it('centres one semantic submitted state and offers an explicit upload-again action', () => {
    project.portfolioFiles.push({idx: 0, kind: 'document', name: 'summary.pdf'});
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector(
      'section.submitted[role="status"]',
    ) as HTMLElement;
    const title = status.querySelector('h2') as HTMLElement;
    const action = status.querySelector('button') as HTMLButtonElement;

    expect(component.projectHasDraftLearningSummaryReport).toBe(true);
    expect(title.textContent).toContain('Learning Summary Report submitted');
    expect(action.textContent).toContain('Upload a new report');
    expect(fixture.nativeElement.querySelector('#learning-summary-validation')).toBeNull();
  });

  it('treats an authorised draft-task report as satisfying portfolio validation', () => {
    project.usesDraftLearningSummary = true;
    fixture.detectChanges();

    expect(component.projectHasDraftLearningSummaryReport).toBe(true);
    expect(fixture.nativeElement.querySelector('section.submitted')).not.toBeNull();
  });
});
