import { Component, Input, OnInit, Inject } from '@angular/core';
import { AlertService } from 'src/app/common/services/alert.service';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';
import { FileDownloaderService } from 'src/app/common/file-downloader/file-downloader.service';
import { ProjectService } from 'src/app/api/services/project.service';
import { confirmationModal } from 'src/app/ajs-upgraded-providers';
import {Injector} from '@angular/core';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'portfolio-review-step',
  templateUrl: './portfolio-review-step.component.html',
  //styleUrls: ['./portfolio-review-step.component.css'],
})
export class PortfolioReviewStepComponent implements OnInit {
  @Input() project!: {
    portfolioFiles: any;
    compilePortfolio?: boolean;
    portfolioAvailable?: boolean;
    portfolioStatus?: number;
    learningSummaryReport?: unknown;
    portfolioUrl: (download: boolean) => string;
    deletePortfolio: () => { subscribe: (cb: () => void) => void };
    extraFiles: unknown[];
    selectedTasks: unknown[];
    student?: { username: string };

  };

  @Input() unit!: unknown;
  private $scope: any;

  hasLSR = false;
  hasTasksSelected = false;
  portfolioIsCompiling = false;
  canCompilePortfolio = false;

  constructor(
    public doubtfireConstants: DoubtfireConstants,
    private alertService: AlertService,
    private projectService: ProjectService,
    private fileDownloaderService: FileDownloaderService,
    private injector: Injector,
    @Inject(confirmationModal) private confirmationModalService: {
      show: (title: string, message: string, action: () => void) => void;
    },
  ) {
    this.$scope = this.injector.get('$scope');
  }

  ngOnInit(): void {
    this.evaluatePortfolioState();
  }

  evaluatePortfolioState(): void {
    this.hasLSR = this.projectHasLearningSummaryReport();
    this.hasTasksSelected = this.selectedTasks().length > 0;
    this.portfolioIsCompiling = !!this.project.compilePortfolio;
    this.canCompilePortfolio =
      !this.portfolioIsCompiling &&
      this.hasTasksSelected &&
      this.hasLSR &&
      !this.project.portfolioAvailable;
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
    this.confirmationModalService.show(
      'Delete Portfolio?',
      'Are you sure you want to delete your portfolio? You will need to recreate your portfolio again if you do so.',
      () => {
        this.project.deletePortfolio().subscribe(() => {
          this.project.portfolioAvailable = false;
          this.project.portfolioStatus = 0;
          this.alertService.message('Portfolio has been deleted!', 5000);
        });
      }
    );
  }

  downloadPortfolio(): void {
    const username = this.project.student?.username || 'portfolio';
    this.fileDownloaderService.downloadFile(
      this.project.portfolioUrl(true),
      `${username}-portfolio.pdf`
    );
  }

  extraFiles(): unknown[] {
    return this.project.extraFiles || [];
  }

  selectedTasks(): unknown[] {
    return this.project.selectedTasks || [];
  }

  projectHasLearningSummaryReport(): boolean {
    return this.project?.portfolioFiles?.filter((file: {idx: number}) => file.idx === 0).length > 0;
  }

  goToPreviousStep(): void {
    if (typeof this.$scope?.advanceActiveTab === 'function') {
      this.$scope.advanceActiveTab(-1);
    }

  }
}
