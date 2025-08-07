import { Component, Input, OnInit, AfterViewInit, ViewChild, ElementRef, Injector, Inject } from '@angular/core';
import { UIRouter } from '@uirouter/angular';
import { unitStudentEnrolmentModal, analyticsService } from 'src/app/ajs-upgraded-providers';
import { Project, Unit } from 'src/app/api/models/doubtfire-model';
import { UserService } from 'src/app/api/services/user.service';

@Component({
  selector: 'f-students-list',
  templateUrl: './students-list.component.html',
  styleUrls: ['./students-list.component.scss']
})
export class FStudentsListComponent implements OnInit, AfterViewInit {
  @Input() unit!: Unit;

  @ViewChild('searchInput', { static: false })
  searchInput!: ElementRef<HTMLInputElement>;

  // UI state
  searchText = '';
  filteredTypeaheadData: string[] = [];
  showSearchOptions = false;
  staffFilter: 'all' | 'mine' = 'all';
  tableSort = { order: 'student.name', reverse: false };
  pagination = {
    currentPage: 1,
    pageSize: 15,
    maxSize: 15,
    totalSize: 0
  };
  filteredProjects: Project[] = [];

  statusClass!: (key: any) => string;
  statusText!: (key: any) => string;

  private showStudentsFilter!: (
    students: readonly Project[],
    staffFilter: 'all' | 'mine',
    tutorUser: any
  ) => readonly Project[];
  private newTaskService: any;

  constructor(
    @Inject(analyticsService) private analytics: any,
    private injector: Injector,
    private router: UIRouter,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    // Grab the old AngularJS filter and task-status helpers
    const $filter = (this.injector as any).get('$filter');
    this.showStudentsFilter = $filter('showStudents');
    this.newTaskService = (this.injector as any).get('newTaskService');

    // Tutors see "mine" by default, other roles see "all"
    this.staffFilter = this.unit.unitRole?.role === 'Tutor' ? 'mine' : 'all';

    this.statusClass = this.newTaskService.statusClass.bind(this.newTaskService);
    this.statusText = this.newTaskService.statusText.bind(this.newTaskService);

    this.filteredTypeaheadData = this.unit.studentFilterTypeAheadData.slice(0, 8);
    this.applyFilters();
  }

  ngAfterViewInit(): void {
    this.searchInput?.nativeElement.focus();
  }

  onSearchTextChange(value: string): void {
    this.searchText = value;
    const term = value.trim().toLowerCase();
    this.filteredTypeaheadData = this.unit.studentFilterTypeAheadData
      .filter((t) => t.toLowerCase().includes(term))
      .slice(0, 8);
    this.applyFilters();
  }

  staffFilterChanged(newFilter: 'all' | 'mine'): void {
    this.staffFilter = newFilter;
    this.applyFilters();
  }

  /** Run the full pipeline (filter → search → sort) and return all results */
  private getAllFiltered(): Project[] {
    // First apply staff filter using the AngularJS "showStudents" filter
    let projects = this.showStudentsFilter(
      this.unit.students,
      this.staffFilter,
      this.userService.currentUser
    ) as Project[];

    // Then apply search text filtering for student name/username or tutor name
    if (this.searchText.trim()) {
      const term = this.searchText.trim().toLowerCase();
      projects = projects.filter((p) => {
        const studentMatch =
          p.student.username.toLowerCase().includes(term) ||
          p.student.name.toLowerCase().includes(term);
        let tutorMatch = false;
        const anyProject = p as any;
        if (anyProject.tutorName && (anyProject.tutorName as string).toLowerCase().includes(term)) {
          tutorMatch = true;
        }
        if (anyProject.tutor && anyProject.tutor.name && (anyProject.tutor.name as string).toLowerCase().includes(term)) {
          tutorMatch = true;
        }
        if (anyProject.tutor && anyProject.tutor.username && (anyProject.tutor.username as string).toLowerCase().includes(term)) {
          tutorMatch = true;
        }
        return studentMatch || tutorMatch;
      });
    }

    return this.sortProjects(projects);
  }

  applyFilters(): void {
    const all = this.getAllFiltered();
    this.pagination.totalSize = all.length;
    const start = (this.pagination.currentPage - 1) * this.pagination.pageSize;
    this.filteredProjects = all.slice(start, start + this.pagination.pageSize);
  }

  private sortProjects(list: Project[]): Project[] {
  const { order, reverse } = this.tableSort;

  return [...list].sort((a, b) => {
    let va: any, vb: any;

    if (order === 'similarityFlag') {
      va = [a.similarityFlag ? 1 : 0, a.student.name];
      vb = [b.similarityFlag ? 1 : 0, b.student.name];
    } else if (order === 'portfolioStatus') {
        va = [a.portfolioStatus ?? '', a.student.name];
        vb = [b.portfolioStatus ?? '', b.student.name];
    } else if (order === 'tutorial.abbreviation') {
      va = a.tutorials?.[0]?.abbreviation ?? '';
      vb = b.tutorials?.[0]?.abbreviation ?? '';
    } else {
      const getValue = (obj: any, path: string) =>
        path.split('.').reduce((o, key) => (o as any)?.[key], obj);
      va = getValue(a, order);
      vb = getValue(b, order);
    }

    if (va < vb) return reverse ? 1 : -1;
    if (va > vb) return reverse ? -1 : 1;
    return 0;
  });
}

  sortTableBy(column: string): void {
    if (column === 'flags') {
      this.showSearchOptions = true;
      setTimeout(() => this.searchInput.nativeElement.focus(), 500);
      return;
    }
    if (this.tableSort.order === column) {
      this.tableSort.reverse = !this.tableSort.reverse;
    } else {
      this.tableSort.order = column;
      this.tableSort.reverse = false;
    }
    this.applyFilters();
  }

  totalProgress(project: Project): number {
    return (project.taskStats || []).reduce((sum, bar) => sum + bar.value, 0);
  }

  getCSVHeader(): string[] {
    const header = ['username', 'name', 'email', 'portfolio'];
    if (this.unit.tutorialStreamsCache.size > 0) {
      this.unit.tutorialStreams.forEach((ts) => header.push(ts.abbreviation));
    } else {
      header.push('tutorial');
    }
    return header;
  }

  /** Map a Project to a plain object whose keys match getCSVHeader() */
  private getCSVRows(projects: Project[]): Record<string, any>[] {
    return projects.map((project) => {
      const row: any = {
        username: project.student.username,
        name: project.student.name,
        email: project.student.email,
        portfolio: project.portfolioStatus
      };
      if (this.unit.tutorialStreamsCache.size > 0) {
        this.unit.tutorialStreams.forEach((ts) => {
          row[ts.abbreviation] = project.tutorialForStream(ts)?.abbreviation || '';
        });
      } else {
        row['tutorial'] = project.tutorials[0]?.abbreviation || '';
      }
      return row;
    });
  }

  downloadCSV(): void {
    // 1) Build header and full data rows
    const header = this.getCSVHeader();
    const rows = this.getCSVRows(this.getAllFiltered());
    // 2) Create CSV content
    const csvArray = [
      header.join(','),
      ...rows.map((r) =>
        header.map((h) => `"${String(r[h] ?? '')}`.replace(/"/g, '""') + '"').join(',')
      )
    ];
    const csvContent = csvArray.join('\r\n');
    // 3) Trigger a download in the browser
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-${this.unit.id}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  showEnrolModal(): void {
    this.analytics.event(
    'Teacher View - Students Tab',
    'Enrol Student'
    );
    const svc = this.injector.get<any>(unitStudentEnrolmentModal);
    svc.show(this.unit);
  }

  viewStudent(project: Project): void {
    this.router.stateService.go('projects/dashboard', {
      projectId: project.student.id,
      tutor: true,
      taskAbbr: ''
    });
  }
}
