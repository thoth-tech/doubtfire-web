import { Component, NgModule, OnInit } from '@angular/core';
import {AlertService} from 'src/app/common/services/alert.service';
import { GradeService } from 'src/app/common/services/grade.service';
import { FileDownloaderService } from 'src/app/common/file-downloader/file-downloader.service';
import { TaskService } from 'src/app/api/services/task.service';
import { UserService } from 'src/app/api/services/user.service';
import { ProjectService } from 'src/app/api/services/project.service';

@Component({
  selector: 'portfolios',
  templateUrl: './portfolios.component.html',
})
export class PortfoliosComponent implements OnInit {
  public studentFilter = 'allStudents';
  public portfolioFilter = 'withPortfolio';
  public activeTab: any;
  public tabs: any;
  public tutor: any;
  public search = "";
  public currentPage = 1;
  public maxSize = 5;
  public pageSize = 10;
  public filterOptions = { selectedGrade: -1 };
  public gradeValues: any;
  public grades: any;
  public gradeAcronyms: any;
  public selectedStudent: any = null;
  public gradeResults = [
    { name: 'Fail', scores: [0, 10, 20, 30, 40, 44] },
    { name: 'Pass', scores: [50, 53, 55, 57] },
    { name: 'Credit', scores: [60, 63, 65, 67] },
    { name: 'Distinction', scores: [70, 73, 75, 77] },
    { name: 'High Distinction', scores: [80, 83, 85, 87] },
    { name: 'High Distinction', scores: [90, 93, 95, 97, 100] }
  ];
  public editingRationale = false;

  constructor(
    private alertService: AlertService,
    private gradeService: GradeService,
    // private newProjectService: NewProjectService,
    // private newTaskService: NewTaskService,
    private fileDownloaderService: FileDownloaderService,
    private taskService: TaskService,
    private userService: UserService,
    private projectService: ProjectService,
  ) { }

  ngOnInit(): void {
    TaskService;
    UserService;
    ProjectService;
    this.gradeValues = this.gradeService.gradeValues;
    this.grades = this.gradeService.grades;
    this.gradeAcronyms = this.gradeService.gradeAcronyms;
    this.tutor = this.userService.currentUser;
    this.tabs = {
      selectStudent: {
        title: "Select Student",
        subtitle: "Select the student to assess",
        seq: 0
      },
      viewProgress: {
        title: "View Progress",
        subtitle: "See the progress of the student",
        seq: 1
      },
      viewPortfolio: {
        title: "View Portfolio",
        subtitle: "See the portfolio of the student",
        seq: 2
      },
      assessPortfolio: {
        title: "Assess Portfolio",
        subtitle: "Enter a grade for the student",
        seq: 3
      }
    };
    this.setActiveTab(this.tabs.selectStudent);
  }
  setActiveTab(tab: any): void {
    if (tab === this.activeTab) return;
    if (this.activeTab) this.activeTab.active = false;
    this.activeTab = tab;
    this.activeTab.active = true;

    if (this.activeTab === this.tabs.viewProgress) {
      // this.visualisation.refreshAll();
    }
  }

  selectStudent(student: any, unit: any): void {
    this.selectedStudent = student;
    this.projectService = null;

    this.projectService.loadProject(student, unit).subscribe({
      next: (project: any) => this.projectService = project,
      error: (message: any) => this.alertService.error(message, 6000)
    });
  }
}

