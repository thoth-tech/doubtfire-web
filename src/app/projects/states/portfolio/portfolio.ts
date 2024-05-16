import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

@NgModule({
  imports: [
    // import necessary modules
    RouterModule.forChild([
      // define child routes here
    ])
  ],
})
export class PortfolioModule { }
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-projects-portfolio',
  templateUrl: 'projects/states/portfolio/portfolio.html'
})
export class ProjectsPortfolioStateCtrl implements OnInit {
  tabs = {
    welcomeStep: { title: "Portfolio Preparation", seq: 1 },
    gradeStep: { title: "Select Grade", seq: 2 },
    summaryStep: { title: "Learning Summary Report", seq: 3 },
    taskStep: { title: "Select Tasks", seq: 4 },
    otherFilesStep: { title: "Upload Other Files", seq: 5 },
    reviewStep: { title: "Review Portfolio", seq: 6 }
  };

  activeTab: any; // Define activeTab property with appropriate type

  constructor(
    // inject necessary services
  ) { }

  ngOnInit() {
    // initialization logic
    // Jump to a step
    if (this.project.portfolioAvailable || this.project.compilePortfolio)
      this.setActiveTab(this.tabs.reviewStep);
    else if (this.projectHasDraftLearningSummaryReport)
      this.setActiveTab(this.tabs.summaryStep);
    else if (this.projectHasLearningSummaryReport())
      this.setActiveTab(this.tabs.taskStep);
    else
      this.setActiveTab(this.tabs.welcomeStep);
  }

  setActiveTab(tab: any) {
    this.activeTab = tab;
    this.activeTab.active = true;
    // analyticsService.event('Portfolio Wizard', 'Switched to Step', `${tab.title} Step`);
  }

  advanceActiveTab(advanceBy: number) {
    const newSeq = this.activeTab.seq + advanceBy;
    this.setActiveTab(Object.values(this.tabs).find(tab => tab.seq === newSeq));
  }

  projectHasLearningSummaryReport() {
    // function logic
  }

  // Other methods...

}
