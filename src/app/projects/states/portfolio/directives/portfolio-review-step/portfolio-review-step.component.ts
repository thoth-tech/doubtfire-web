import { Component, Input, OnInit, Inject, DoCheck } from '@angular/core';
import { AlertService } from 'src/app/common/services/alert.service';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';
import { FileDownloaderService } from 'src/app/common/file-downloader/file-downloader.service';
import { ProjectService } from 'src/app/api/services/project.service';
import { confirmationModal } from 'src/app/ajs-upgraded-providers';
import {Injector} from '@angular/core';
import { Project } from 'src/app/api/models/project';
@Component({
  selector: 'portfolio-review-step',
  templateUrl: './portfolio-review-step.component.html',
  styleUrls: ['./portfolio-review-step.component.scss'],
})
export class PortfolioReviewStepComponent implements OnInit, DoCheck {
  @Input() project!: Project;
  @Input() unit!: Unit;
  private $scope: unknown;

  hasLSR = false;
  hasTasksSelected = false;
  portfolioIsCompiling = false;
  canCompilePortfolio = false;
  private lastActiveTab: unknown;

  // Expose scope variables for template access
  get activeTab() {
    return (this.$scope as { activeTab?: unknown })?.activeTab;
  }

  get tabs() {
    return (this.$scope as { tabs?: unknown })?.tabs;
  }

  get isVisible() {
    return (this.$scope as { activeTab?: unknown; tabs?: { reviewStep?: unknown } })?.activeTab === (this.$scope as { tabs?: { reviewStep?: unknown } })?.tabs?.reviewStep;
  }

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
    this.$scope = this.injector.get('$scope', null);
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
    return this.project.portfolioFiles?.filter((file: { idx: number }) => file.idx !== 0) || [];
  }

  selectedTasks(): unknown[] {
    if (!this.project.tasks) return [];
    const tasksToInclude = this.project.tasks.filter((task: unknown) => (task as { includeInPortfolio: boolean }).includeInPortfolio);
    return tasksToInclude;
  }

  projectHasLearningSummaryReport(): boolean {
    return this.project?.portfolioFiles?.filter((file: {idx: number}) => file.idx === 0).length > 0;
  }

  goToPreviousStep(): void {
    if (typeof (this.$scope as { advanceActiveTab?: (step: number) => void })?.advanceActiveTab === 'function') {
      (this.$scope as { advanceActiveTab: (step: number) => void }).advanceActiveTab(-1);
    }
  }

  refreshPortfolioState(): void {
    this.evaluatePortfolioState();
  }

  ngDoCheck(): void {
    // Check if the active tab has changed and refresh state when this tab becomes visible
    const currentActiveTab = this.activeTab;
    if (currentActiveTab !== this.lastActiveTab) {
      this.lastActiveTab = currentActiveTab;
      if (this.isVisible) {
        this.evaluatePortfolioState();
      }
    }
  }
}
