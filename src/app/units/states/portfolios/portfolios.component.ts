import {Component, Inject, Input, OnInit} from '@angular/core';
import {AlertService} from 'src/app/common/services/alert.service';
import {UserService} from 'src/app/api/services/user.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {ProjectService} from 'src/app/api/services/project.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';
import {analyticsService} from 'src/app/ajs-upgraded-providers';

interface Tab {
  title: string;
  subtitle: string;
  seq: number;
  active?: boolean;
}

interface GradeResult {
  name: string;
  scores: number[];
}

interface User {
  id: number;
  name: string;
  email: string;
}

@Component({
  selector: 'f-portfolios',
  templateUrl: './portfolios.component.html',
  styleUrls: ['./portfolios.component.scss']
})
export class PortfoliosComponent implements OnInit {
  tabs: Record<string, Tab> = {
    selectStudent: { title: "Select Student", subtitle: "Select the student to assess", seq: 0 },
    viewProgress: { title: "View Progress", subtitle: "See the progress of the student", seq: 1 },
    viewPortfolio: { title: "View Portfolio", subtitle: "See the portfolio of the student", seq: 2 },
    assessPortfolio: { title: "Assess Portfolio", subtitle: "Enter a grade for the student", seq: 3 }
  };

  activeTab: Tab = this.tabs.selectStudent;
  tutor: User;
  search = '';
  currentPage = 1;
  maxSize = 5;
  pageSize = 10;
  filterOptions = { selectedGrade: -1 };
  gradeResults: GradeResult[] = [
    { name: 'Fail', scores: [0, 10, 20, 30, 40, 44] },
    { name: 'Pass', scores: [50, 53, 55, 57] },
    { name: 'Credit', scores: [60, 63, 65, 67] },
    { name: 'Distinction', scores: [70, 73, 75, 77] },
    { name: 'High Distinction', scores: [80, 83, 85, 87] },
    { name: 'High Distinction', scores: [90, 93, 95, 97, 100] }
  ];

  editingRationale = false;
  selectedStudent: User | null = null;
  project: Project | null = null;
  @Input() unit: Unit | null = null;

  constructor(
    private userService: UserService,
    private alertService: AlertService,
    private gradeService: GradeService,
    private projectService: ProjectService,
    private fileDownloaderService: FileDownloaderService,
    @Inject(analyticsService) private AnalyticsService,
  )
  {
    this.tutor = this.userService.currentUser;
  }

  ngOnInit(): void {
    this.setActiveTab(this.tabs.selectStudent);
    this.AnalyticsService.event('studentFilter', 'Teacher View - Grading Tab');
    this.AnalyticsService.event('sortOrder', 'Teacher View - Grading Tab');
    this.AnalyticsService.event('currentPage', 'Teacher View - Grading Tab', 'Selected Page');
  }

  setActiveTab(tab: Tab): void {
    if (tab === this.activeTab) return;

    if (this.activeTab) this.activeTab.active = false;
    this.activeTab = tab;
    this.activeTab.active = true;
  }

  toggleEditRationale(): void {
    this.editingRationale = !this.editingRationale;
  }

  selectStudent(student: User): void {
    this.selectedStudent = student;
    this.project = null;

    this.projectService.loadProject(student.id, this.unit).subscribe({
      next: (project: Project) => {
        this.project = project;
      },
      error: (message: string) => this.alertService.error(message, 6000)
    });
  }

  downloadGrades(): void {
    if (this.unit?.gradesUrl && this.unit?.code) {
      this.fileDownloaderService.downloadFile(this.unit.gradesUrl, `${this.unit.code}-grades.csv`);
    }
  }

  downloadPortfolios(): void {
    if (this.unit?.portfoliosUrl && this.unit?.code) {
      this.fileDownloaderService.downloadFile(this.unit.portfoliosUrl, `${this.unit.code}-portfolios.zip`);
    }
  }

  get sortedTabs() {
    return Object.values(this.tabs).sort((a, b) => a.seq - b.seq);
  }
}
