import {Component, Input, OnInit, OnChanges} from '@angular/core';
import {AlertService} from 'src/app/common/services/alert.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {ProjectService} from 'src/app/api/services/project.service';
import {UIRouter} from '@uirouter/angular';
import _ from 'lodash';

@Component({
  selector: 'f-portfolio-review-step',
  templateUrl: 'portfolio-review-step.component.html',
  //styleUrls: ['./portfolio-review-step.component.scss'],
})
export class PortfolioReviewStepComponent implements OnInit, OnChanges {
  confirmationModal: any;
  advanceActiveTab(arg0) {
    throw new Error('Method not implemented.');
  }
  @Input() project: any;
  @Input() unit: any;
  private $scope: any;

  externalName = DoubtfireConstants.ExternalName;
  hasLSR = false;
  hasTasksSelected = false;
  portfolioIsCompiling = false;
  canCompilePortfolio = false;
  activeTab: any;

  constructor(
    private alertService: AlertService,
    private newProjectService: ProjectService,
    private fileDownloaderService: FileDownloaderService,
    private router: UIRouter,
  ) {}

  ngOnInit(): void {
    this.reassessPortfolioState();
  }

  ngOnChanges(): void {
    this.reassessPortfolioState();
  }

  private reassessPortfolioState(): void {
    if (!this.project) return;
    this.hasLSR = this.projectHasLearningSummaryReport();
    this.hasTasksSelected = this.selectedTasks().length > 0;
    this.portfolioIsCompiling = this.project.compilePortfolio;
    this.canCompilePortfolio =
      !this.portfolioIsCompiling &&
      this.hasTasksSelected &&
      this.hasLSR &&
      !this.project.portfolioAvailable;
  }

  toggleCompileProject(): void {
    this.project.compilePortfolio = !this.project.compilePortfolio;
    this.newProjectService.update(this.project).subscribe(() => {
      this.portfolioIsCompiling = true;
      this.canCompilePortfolio = false;
      this.project.portfolioStatus = 0.5;
    });
  }

  deletePortfolio(): void {
    this.confirmationModal.show(
      'Delete Portfolio?',
      'Are you sure you want to delete your portfolio? You will need to recreate your portfolio again if you do so.',
      () => {
        this.project.deletePortfolio().subscribe(() => {
          this.project.portfolioAvailable = false;
          this.project.portfolioStatus = 0;
          this.alertService.message('Portfolio has been deleted!', 5000);
        });
      },
    );
  }

  downloadPortfolio(): void {
    const filename = `${this.project.student.username}-portfolio.pdf`;
    this.fileDownloaderService.downloadFile(this.project.portfolioUrl(true), filename);
  }

  private selectedTasks(): any[] {
    return this.project?.tasks?.filter((task) => task.selected) ?? [];
  }

  private projectHasLearningSummaryReport(): boolean {
    return !!this.project?.learningSummaryReport;
  }
}
