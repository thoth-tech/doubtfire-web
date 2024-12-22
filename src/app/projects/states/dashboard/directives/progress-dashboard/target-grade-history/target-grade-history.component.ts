import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { GradeService } from 'src/app/common/services/grade.service';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  nickname: string;
}

interface TargetGradeHistory {
  id: number;
  previous_grade: string | number;
  new_grade: string | number;
  changed_at: string;
  changed_by: User;
}

@Component({
  selector: 'f-target-grade-history',
  templateUrl: './target-grade-history.component.html',
  styleUrls: ['./target-grade-history.component.scss']
})
export class TargetGradeHistoryComponent implements OnInit, OnChanges {
  @Input() projectId!: number;       
  @Input() targetGrade?: string;     

  // Data
  targetGradeHistory: TargetGradeHistory[] = [];
  paginatedGradeHistory: TargetGradeHistory[] = [];

  // UI State
  loading = false;
  error: string | null = null;

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  constructor(
    private http: HttpClient,
    private gradeService: GradeService,
    private constants: DoubtfireConstants
  ) {}

  ngOnInit(): void {
    if (this.projectId) {
      this.loadTargetGradeHistory();
    }
  }

  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes.projectId && !changes.projectId.firstChange) {
      this.currentPage = 1; 
      this.loadTargetGradeHistory();
    }

    if (changes.targetGrade && !changes.targetGrade.firstChange) {
      this.loadTargetGradeHistory();
    }
  }

  
  private loadTargetGradeHistory(): void {
    if (!this.projectId) {
      console.error('No projectId provided to TargetGradeHistoryComponent');
      this.error = 'Project ID is required';
      return;
    }

    this.loading = true;
    this.error = null;

    const url = `${this.constants.API_URL}/projects/${this.projectId}/target_grade_histories`
      + `?page=${this.currentPage}&limit=${this.itemsPerPage}`;

    this.http.get<any>(url).pipe(
      catchError((err) => {
        console.error('Error fetching target grade history:', err);
        this.error = 'Failed to load target grade history';
        return of({ target_grade_histories: [], total_histories: 0 });
      })
    ).subscribe(response => {
      const histories = response.target_grade_histories || [];
      const totalCount = response.total_histories || 0;

      this.targetGradeHistory = histories.map((h: any) => ({
        ...h,
        previous_grade: this.gradeService.grades[h.previous_grade] || h.previous_grade,
        new_grade: this.gradeService.grades[h.new_grade] || h.new_grade
      }));

     
      this.paginatedGradeHistory = this.targetGradeHistory;
      this.totalPages = Math.ceil(totalCount / this.itemsPerPage);

      this.loading = false;
    });
  }

  
  public goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadTargetGradeHistory();
    }
  }
}