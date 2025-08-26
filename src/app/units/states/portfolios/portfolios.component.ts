import {Component, Inject, Input, OnInit} from '@angular/core';
import {AlertService} from 'src/app/common/services/alert.service';
import {UserService} from 'src/app/api/services/user.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {ProjectService} from 'src/app/api/services/project.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';
import {analyticsService} from 'src/app/ajs-upgraded-providers';
import {StateService} from '@uirouter/angular';
import {UnitService} from 'src/app/api/services/unit.service';
import { BehaviorSubject, Observable } from 'rxjs';

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

  unitId: string;

  activeTab: Tab = this.tabs.selectStudent;
  tutor: User;
  search = '';
  currentPage = 1;
  maxSize = 5;
  pageSize = 10;
  filterOptions = { selectedGrade: -1 };
  portfolioFilter = 'allStudents';
  studentFilter = 'allStudents';
  gradeResults: GradeResult[] = [
    { name: 'Fail', scores: [0, 10, 20, 30, 40, 44] },
    { name: 'Pass', scores: [50, 53, 55, 57] },
    { name: 'Credit', scores: [60, 63, 65, 67] },
    { name: 'Distinction', scores: [70, 73, 75, 77] },
    { name: 'High Distinction', scores: [80, 83, 85, 87, 90, 93, 95, 97, 100] }
  ];

  editingRationale = false;
  selectedStudent: User | null = null;
  project: Project | null = null;
  students: any[] = [];
  @Input() unit: Unit | null = null;
  private projectSubject = new BehaviorSubject<Project | null>(null);
  project$: Observable<Project | null> = this.projectSubject.asObservable();


  constructor(
    private userService: UserService,
    private alertService: AlertService,
    private gradeService: GradeService,
    private projectService: ProjectService,
    private fileDownloaderService: FileDownloaderService,
    private stateService: StateService,
    private unitService: UnitService,
    @Inject(analyticsService) private AnalyticsService,
  )
  {
    this.tutor = this.userService.currentUser;
  }

  ngOnInit(): void {
    this.unitId = this.stateService.params['unitId'];
    this.setUnit();
    this.setActiveTab(this.tabs.selectStudent);
    this.AnalyticsService.event('studentFilter', 'Teacher View - Grading Tab');
    this.AnalyticsService.event('sortOrder', 'Teacher View - Grading Tab');
    this.AnalyticsService.event('currentPage', 'Teacher View - Grading Tab', 'Selected Page');
  }

  setUnit(): void {
    if (this.unitId) {
      const unitObs = this.unitService.get(this.unitId);
      if (!unitObs) {
        console.error('unitService.get returned undefined!');
        return;
      }
      unitObs.subscribe({
        next: (unit) => {
          const studentsObs = this.projectService.loadStudents(unit);
          if (!studentsObs) {
            console.error('projectService.loadStudents returned undefined!');
            return;
          }
          studentsObs.subscribe({
            next: (students) => {
              this.unit = unit;
              this.students = students;
              console.log('Students:', students);
              console.log('Unit:', unit);
            },
          });
        },
        error: (err) => {
          console.error('Error loading unit:', err);
        }
      });
    }
  }


  isMyStudent(student: any): boolean {
    return student.tutorId === this.tutor.id;
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
    this.projectSubject.next(null);

    this.projectService.loadProject(student.id, this.unit).subscribe({
      next: (project: Project) => {
        this.project = project;
        this.projectSubject.next(project);
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

  get sortedTabs(): Tab[] {
    return Object.values(this.tabs).sort((a, b) => a.seq - b.seq);
  }

  get filteredStudents() {
    let filtered = this.students;

    if (this.portfolioFilter === 'withPortfolio') {
      filtered = filtered.filter(s => s.hasPortfolio);
    }

    if (this.studentFilter === 'myStudents') {
      filtered = filtered.filter(s => this.isMyStudent(s));
    }

    if (this.filterOptions.selectedGrade !== -1) {
      filtered = filtered.filter(s => s.grade === this.filterOptions.selectedGrade);
    }

    if (this.search) {
      const searchLower = this.search.toLowerCase();
      filtered = filtered.filter(s => s.name.toLowerCase().includes(searchLower) || s.email.toLowerCase().includes(searchLower));
    }

    return filtered;
  }
  filteredTaskStats(student): any[] {
    if (!student?.taskStats) return [];
    return student.taskStats.filter(this.barLargerZero);
  }

  private barLargerZero(taskStat: any): boolean {
    return taskStat.value > 0;
  }
  statusClass(key: string): string {
    if (key === 'complete') return 'progress-complete';
    if (key === 'inProgress') return 'progress-inprogress';
    return 'progress-default';
  }
}
