import {beforeEach, describe, expect, it, vi} from 'vitest';
import {BehaviorSubject} from 'rxjs';
import {Project} from 'src/app/api/models/project';
import {PortfolioReviewStepComponent} from './portfolio-review-step.component';

describe('PortfolioReviewStepComponent', () => {
  let component: PortfolioReviewStepComponent;
  let downloadFileWithFeedback: ReturnType<typeof vi.fn>;
  let celebrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    downloadFileWithFeedback = vi.fn();
    celebrate = vi.fn();
    component = new PortfolioReviewStepComponent(
      {ExternalName: new BehaviorSubject('OnTrack')} as never,
      {} as never,
      {toBeWorkedOn: []} as never,
      {} as never,
      {} as never,
      {downloadFileWithFeedback} as never,
      {celebrate} as never,
    );
    component.project = {
      id: 17,
      student: {username: 'demo_student'},
      usesDraftLearningSummary: false,
      portfolioFiles: [],
      portfolioUrl: () => '/projects/17/portfolio?as_attachment=true',
      tasks: [],
    } as unknown as Project;
  });

  it('uses the Batch 04 download-start feedback helper with a stable request key', () => {
    component.downloadPortfolio();

    expect(downloadFileWithFeedback).toHaveBeenCalledWith(
      '/projects/17/portfolio?as_attachment=true',
      'demo_student-portfolio.pdf',
      {requestKey: 'portfolio-17'},
    );
  });

  it('keeps the review validation consistent with a submitted draft-task report', () => {
    component.project.usesDraftLearningSummary = true;
    expect(component.hasLearningSummaryReport).toBe(true);
  });
});
