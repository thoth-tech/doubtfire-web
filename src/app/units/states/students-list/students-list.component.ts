import {
  csvUploadModalService,
  csvResultModalService,
  unitStudentEnrolmentModal,
} from 'src/app/ajs-upgraded-providers';
import { ViewChild, Component, Input, Inject, AfterViewInit, OnDestroy } from '@angular/core';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatSort, Sort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { HttpClient } from '@angular/common/http';
import { FileDownloaderService } from 'src/app/common/file-downloader/file-downloader.service';
import { Project, ProjectService, TaskService, Unit } from 'src/app/api/models/doubtfire-model';
import { UIRouter } from '@uirouter/angular';
import { Subscription } from 'rxjs';
import { AlertService } from 'src/app/common/services/alert.service';
import { GradeService } from 'src/app/common/services/grade.service';

@Component({
  selector: 'f-students-list',
  templateUrl: './students-list.component.html',
  styleUrls: ['./students-list.component.scss'],
})
export class FStudentsListComponent implements AfterViewInit, OnDestroy {
  @ViewChild(MatTable, { static: false }) table: MatTable<Project>;
  @ViewChild(MatSort, { static: false }) sort: MatSort;
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

  @Input() unit: Unit;

  statusClass;
  private subscriptions: Subscription[] = [];

  columns: string[] = ['icon', 'username', 'name', 'stats', 'flags', 'campus', 'tutorial'];
  dataSource: MatTableDataSource<Project>;
  // Calls the parent's constructor, passing in an object
  // that maps all of the form controls that this form consists of.
  constructor(
    private httpClient: HttpClient,
    @Inject(unitStudentEnrolmentModal) private enrolModal: any,
    private alerts: AlertService,
    private taskService: TaskService,
    @Inject(csvUploadModalService) private csvUploadModal: any,
    @Inject(csvResultModalService) private csvResultModal: any,
    private fileDownloader: FileDownloaderService,
    private gradeService: GradeService,
    private router: UIRouter,
    private projectService: ProjectService,
  ) {}

  // The paginator is inside the table
  ngAfterViewInit() {
    this.statusClass = this.taskService.statusClass;
    this.dataSource = new MatTableDataSource(this.unit.studentCache.currentValuesClone());
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = (data: any, filter: string) => data.matches(filter);

    this.subscriptions.push(
      this.unit.studentCache.values.subscribe((students) => {
        this.dataSource.data = students;
      }),
    );

    this.subscriptions.push(
      this.projectService.loadStudents(this.unit, true).subscribe(() => {
        // projects included in unit...
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  gradeText(grade: number): string {
    return this.gradeService.grades[grade] || 'Grade';
  }
  gradeClass(inputGrade) {
    const grade = this.gradeNumber(inputGrade);
    return {
      'colorful': false,
      'grade-0': grade === 0,
      'grade-1': grade === 1,
      'grade-2': grade === 2,
      'grade-3': grade === 3,
    };
  }
  gradeNumber(inputGrade) {
    let grade;
    if (typeof inputGrade === 'string') {
      grade = this.gradeService.stringToGrade(inputGrade);
    } else {
      grade = inputGrade;
    }
    return grade;
  }
  gradeLetter(inputGrade): string {
    return this.gradeService.gradeAcronyms[this.gradeNumber(inputGrade)] || 'G';
  }
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private sortCompare(aValue: number | string, bValue: number | string, isAsc: boolean) {
    return (aValue < bValue ? -1 : 1) * (isAsc ? 1 : -1);
  }

  // Sorting function to sort data when sort
  // event is triggered
  sortTableData(sort: Sort) {
    if (!sort.active || sort.direction === '') {
      return;
    }
    this.dataSource.data = this.dataSource.data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'username':
        case 'name':
        case 'stats':
        case 'flags':
        case 'campus':
          return this.sortCompare(a.campus?.abbreviation, b.campus?.abbreviation, isAsc);
        default:
          return 0;
      }
    });
  }

  public viewStudent(student: Project) {
    this.router.stateService.go('projects/dashboard', {
      projectId: student.id,
      tutor: true,
      taskAbbr: '',
    });
  }

  enrolStudent() {
    this.enrolModal.show(this.unit);
  }

  downloadEnrolments() {
    const url: string = this.unit.enrolStudentsCSVUrl;

    this.fileDownloader.downloadFile(url, `${this.unit.code}-students.csv`);
  }
}
