import {
  Component,
  Injector,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewContainerRef,
} from '@angular/core';
import {UIRouter} from '@uirouter/core';
import * as _ from 'lodash';

import {Task} from 'src/app/api/models/task';
import {TaskService} from 'src/app/api/services/task.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {TaskAssessmentModalService} from 'src/app/common/modals/task-assessment-modal/task-assessment-modal.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {SelectedTaskService} from '../../selected-task.service';
import {DashboardViews} from '../../selected-task.service';


import {TooltipService} from '@swimlane/ngx-charts';

@Component({
  selector: 'f-task-dashboard',
  templateUrl: './task-dashboard.component.html',
  styleUrls: ['./task-dashboard.component.scss'],
})
export class TaskDashboardComponent implements OnInit, OnChanges {
  @Input() task: Task;
  @Input() pdfUrl: string;

  private chartToolTipService: TooltipService;
  readonly viewContainerRef: ViewContainerRef;

  data = [
    {
      'name': 'Pass',
      'value': 100,
      'label': '100%',
    },
    {
      'name': 'Credit',
      'value': 79,
    },
    {
      'name': 'Distinction',
      'value': 5,
    },
    {
      'name': 'HD',
      'value': 1,
    },
  ];
  view = [400, 250];
  legend: boolean = true;
  legendPosition: string = 'below';

  colorScheme = {
    domain: ['#5AA454', '#E44D25', '#CFC0BB', '#7aa3e5', '#a8385d', '#aae3f5'],
  };

  // constructor() {
  //   Object.assign(this, { single });
  // }

  onSelect(data): void {
    console.log('Item clicked', JSON.parse(JSON.stringify(data)));
  }

  onActivate(data): void {
    console.log('Activate', JSON.parse(JSON.stringify(data)));
  }

  onDeactivate(data): void {
    console.log('Deactivate', JSON.parse(JSON.stringify(data)));
  }

  public DashboardViews = DashboardViews;

  public taskStatusData: any;
  public tutor = this.router.globals.params.tutor;
  public urls: {
    taskSubmissionPdfAttachmentUrl: string;
    taskFilesUrl: string;
    taskSheetPdfUrl?: string;
    taskSubmissionPdfUrl?: string;
  };
  public overseerEnabledObs = this.doubtfire.IsOverseerEnabled;
  public currentView: DashboardViews;

  constructor(
    private injectorObj: Injector,
    private doubtfire: DoubtfireConstants,
    private taskService: TaskService,
    private taskAssessmentModal: TaskAssessmentModalService,
    private fileDownloader: FileDownloaderService,
    private router: UIRouter,
    public selectedTaskService: SelectedTaskService,
  ) {
    this.chartToolTipService = this.injectorObj.get(TooltipService);
    this.viewContainerRef = this.injectorObj.get(ViewContainerRef);
  }

  ngOnInit(): void {
    this.chartToolTipService.injectionService.setRootViewContainer(this.viewContainerRef);
    this.selectedTaskService.currentView$.next(DashboardViews.submission);
    this.selectedTaskService.currentView$.subscribe((view) => {
      this.currentView = view;
    });

    this.taskStatusData = {
      keys: this.taskService.markedStatuses.slice().sort((a, b) => {
        return this.taskService.statusSeq.get(a) - this.taskService.statusSeq.get(b);
      }),
      help: this.taskService.helpDescriptions,
      icons: this.taskService.statusIcons,
      labels: this.taskService.statusLabels,
      class: this.taskService.statusClass,
    };
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.task && changes.task.currentValue) {
      this.urls = {
        taskSheetPdfUrl: changes.task.currentValue.definition.getTaskPDFUrl(),
        taskSubmissionPdfUrl: changes.task.currentValue.submissionUrl(),
        taskSubmissionPdfAttachmentUrl: changes.task.currentValue.submissionUrl(true),
        taskFilesUrl: changes.task.currentValue.submittedFilesUrl(),
      };
    }
  }

  public get overseerEnabled() {
    return this.doubtfire.IsOverseerEnabled.value && this.task?.overseerEnabled;
  }

  showSubmissionHistoryModal() {
    this.taskAssessmentModal.show(this.task);
  }

  downloadSubmission() {
    this.fileDownloader.downloadFile(this.urls.taskSubmissionPdfAttachmentUrl, 'submission.pdf');
  }

  downloadSubmittedFiles() {
    this.fileDownloader.downloadFile(this.urls.taskFilesUrl, 'submitted-files.zip');
  }
}
