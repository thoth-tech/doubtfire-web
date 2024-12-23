import {Component, Input, OnInit, OnDestroy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {catchError} from 'rxjs/operators';
import {of, interval, Subscription} from 'rxjs';
import {GradeService} from 'src/app/common/services/grade.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  nickname: string;
}

interface TargetGradeHistory {
  previous_grade: string | number;
  new_grade: string | number;
  changed_at: string;
  changed_by: User;
}

@Component({
  selector: 'f-target-grade-history',
  templateUrl: './target-grade-history.component.html',
  styleUrls: ['./target-grade-history.component.scss'],
})
export class TargetGradeHistoryComponent implements OnInit, OnDestroy {
  @Input() projectId!: number;

  targetGradeHistory: TargetGradeHistory[] = [];
  paginatedGradeHistory: TargetGradeHistory[] = [];
  loading = false;
  error: string | null = null;

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  private gradeCheckSubscription!: Subscription;

  constructor(
    private http: HttpClient,
    private gradeService: GradeService,
    private constants: DoubtfireConstants,
  ) {}

  ngOnInit(): void {
    if (this.projectId) {
      this.loadTargetGradeHistory();
      this.startGradeChangeListener();
    }
  }

  ngOnDestroy(): void {
    if (this.gradeCheckSubscription) {
      this.gradeCheckSubscription.unsubscribe();
    }
  }

  private loadTargetGradeHistory(): void {
    if (!this.projectId) {
      console.error('No projectId provided');
      this.error = 'Project ID is required';
      return;
    }

    this.loading = true;
    this.error = null;

    const url = `${this.constants.API_URL}/projects/${this.projectId}`;

    this.http
      .get<any>(url)
      .pipe(
        catchError((error) => {
          console.error('Error fetching target grade history:', error);
          this.error = 'Failed to load target grade history';
          return of({target_grade_histories: []});
        }),
      )
      .subscribe({
        next: (response) => {
          this.targetGradeHistory = response.target_grade_histories
            .filter(
              (history: TargetGradeHistory) =>
                history.previous_grade !== undefined && history.new_grade !== undefined,
            )
            .map((history: TargetGradeHistory) => ({
              ...history,
              previous_grade: this.gradeService.grades[history.previous_grade] || 'N/A',
              new_grade: this.gradeService.grades[history.new_grade] || 'N/A',
            }))
            .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()); // Sort newest first

          this.updatePagination();
          this.loading = false;
        },
        error: () => {
          this.error = 'Failed to load target grade history';
          this.loading = false;
        },
      });
  }

  private startGradeChangeListener(): void {
    const checkInterval = 3000; // 3 seconds
    this.gradeCheckSubscription = interval(checkInterval).subscribe(() => {
      this.checkForGradeChange();
    });
  }

  private checkForGradeChange(): void {
    const url = `${this.constants.API_URL}/projects/${this.projectId}`;
    this.http
      .get<any>(url)
      .pipe(
        catchError((error) => {
          console.error('Error checking for grade change:', error);
          return of(null);
        }),
      )
      .subscribe((response) => {
        if (response && response.target_grade_histories) {
          const latestHistory = response.target_grade_histories.map(
            (history: TargetGradeHistory) => ({
              ...history,
              previous_grade: this.gradeService.grades[history.previous_grade] || 'N/A',
              new_grade: this.gradeService.grades[history.new_grade] || 'N/A',
            }),
          );

          if (JSON.stringify(this.targetGradeHistory) !== JSON.stringify(latestHistory)) {
            this.targetGradeHistory = latestHistory.sort(
              (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
            );
            this.updatePagination();
          }
        }
      });
  }

  private updatePagination(): void {
    this.totalPages = Math.ceil(this.targetGradeHistory.length / this.itemsPerPage);
    this.updatePaginatedGradeHistory();
  }

  private updatePaginatedGradeHistory(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedGradeHistory = this.targetGradeHistory.slice(startIndex, endIndex);
  }

  public goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedGradeHistory();
    }
  }
}
