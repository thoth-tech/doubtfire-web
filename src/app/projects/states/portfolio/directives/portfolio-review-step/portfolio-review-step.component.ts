// This is a fixed and cleaned-up version of portfolio-review-step.component.ts

import {Component, Input, OnInit} from '@angular/core';
import {AlertService} from 'src/app/common/services/alert.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {ProjectService} from 'src/app/api/services/project.service';
import {confirmationModal} from 'src/app/ajs-upgraded-providers';

@Component({
  selector: 'f-portfolio-review-step',
  templateUrl: './portfolio-review-step.component.html',
  styleUrls: ['./portfolio-review-step.component.scss'],
})
export class PortfolioReviewStepComponent implements OnInit {
  @Input() project: any;
  @Input() unit: any;

  hasLSR = false;
  hasTasksSelected = false;
  portfolioIsCompiling = false;
  canCompilePortfolio = false;
  dialog: any;
  $scope: any;

  constructor(
    public doubtfireConstants: DoubtfireConstants,
    private alertService: AlertService,
    private projectService: ProjectService,
    private fileDownloaderService: FileDownloaderService,
  ) {}

  ngOnInit(): void {
    this.evaluatePortfolioState();
  }

  evaluatePortfolioState(): void {
    this.hasLSR = this.projectHasLearningSummaryReport();
    this.hasTasksSelected = (this.selectedTasks() || []).length > 0;
    this.portfolioIsCompiling = this.project?.compilePortfolio;
    this.canCompilePortfolio =
      !this.portfolioIsCompiling &&
      this.hasTasksSelected &&
      this.hasLSR &&
      !this.project?.portfolioAvailable;
  }

  toggleCompileProject(): void {
    this.project.compilePortfolio = !this.project.compilePortfolio;

    this.projectService.update(this.project).subscribe(() => {
      this.portfolioIsCompiling = true;
      this.canCompilePortfolio = false;
      this.project.portfolioStatus = 0.5;
    });
  }

  deletePortfolio(): void {
    const dialogRef = this.dialog.open(confirmationModal, {
      data: {
        title: 'Delete Portfolio?',
        message:
          'Are you sure you want to delete your portfolio? You will need to recreate your portfolio again if you do so.',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.project.deletePortfolio().subscribe(() => {
          this.project.portfolioAvailable = false;
          this.project.portfolioStatus = 0;
          this.alertService.message('Portfolio has been deleted!', 5000);
        });
      } else {
        this.alertService.message('Delete Portfolio action cancelled', 3000);
      }
    });
  }

  downloadPortfolio(): void {
    this.fileDownloaderService.downloadFile(
      this.project?.portfolioUrl(true),
      `${this.project?.student?.username}-portfolio.pdf`,
    );
  }

  extraFiles(): any[] {
    return this.project?.extraFiles || [];
  }

  selectedTasks(): any[] {
    return this.project?.selectedTasks || [];
  }

  projectHasLearningSummaryReport(): boolean {
    return !!this.project?.learningSummaryReport;
  }

  goToPreviousStep(): void {
    if (typeof this.$scope?.advanceActiveTab === 'function') {
      this.$scope.advanceActiveTab(-1);
    }
  }
}
