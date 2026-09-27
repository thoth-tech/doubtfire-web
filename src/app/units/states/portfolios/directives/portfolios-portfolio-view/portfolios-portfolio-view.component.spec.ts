import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {Project} from 'src/app/api/models/project';
import {EmptyStateComponent} from 'src/app/common/empty-state/empty-state.component';
import {PortfoliosPortfolioViewComponent} from './portfolios-portfolio-view.component';

describe('PortfoliosPortfolioViewComponent', () => {
  let fixture: ComponentFixture<PortfoliosPortfolioViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PortfoliosPortfolioViewComponent],
      imports: [EmptyStateComponent, MatButtonModule],
      // The pdf viewer is not under test here.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  function render(project: Partial<Project>): void {
    fixture = TestBed.createComponent(PortfoliosPortfolioViewComponent);
    fixture.componentRef.setInput('project', {
      student: {name: 'Amy Adams'},
      portfolioUrl: () => 'https://api.test/submission/project/5/portfolio',
      ...project,
    } as unknown as Project);
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  }

  it('shows the portfolio when one is ready', () => {
    render({portfolioAvailable: true});

    expect(fixture.nativeElement.querySelector('f-pdf-viewer')).not.toBeNull();
  });

  it('explains a missing portfolio and offers the progress instead', () => {
    render({portfolioAvailable: false, compilePortfolio: false});
    const showProgress = vi.fn();
    fixture.componentInstance.showProgress.subscribe(showProgress);

    expect(text()).toContain('No portfolio submitted yet');
    expect(text()).toContain('Amy Adams has not submitted a portfolio');

    fixture.nativeElement.querySelector('button').click();
    expect(showProgress).toHaveBeenCalledTimes(1);
  });

  it('says when a portfolio is still being created', () => {
    render({portfolioAvailable: false, compilePortfolio: true});

    expect(text()).toContain('The portfolio is being created');
  });
});
