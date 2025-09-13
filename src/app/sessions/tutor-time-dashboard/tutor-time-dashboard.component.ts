import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Session {
  start: string;
  end: string;
  duration: string;
  unitCode: string;
}

@Component({
  selector: 'f-tutor-time-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tutor-time-dashboard.component.html',
  styleUrls: ['./tutor-time-dashboard.component.css']
})
export class TutorTimeDashboardComponent implements OnInit {
  sessions: Session[] = [];
  paginatedSessions: Session[] = [];
  currentPage = 1;
  pageSize = 5;
  totalPages = 1;
  sortField: keyof Session | '' = '';
  sortAsc = true;

  ngOnInit(): void {
    // Mock data
    this.sessions = [
      { start: '2025-09-15 09:00', end: '2025-09-15 11:00', duration: '2h 0m', unitCode: 'COS20007' },
      { start: '2025-09-16 14:00', end: '2025-09-16 15:30', duration: '1h 30m', unitCode: 'COS20007' },
      { start: '2025-09-17 08:00', end: '2025-09-17 09:30', duration: '1h 30m', unitCode: 'COS20007' },
      { start: '2025-09-18 10:00', end: '2025-09-18 12:00', duration: '2h 0m', unitCode: 'COS20007' },
      { start: '2025-09-19 13:00', end: '2025-09-19 14:15', duration: '1h 15m', unitCode: 'COS20007' },
      { start: '2025-09-20 09:00', end: '2025-09-20 10:00', duration: '1h 0m', unitCode: 'COS20007' }
    ];

    this.totalPages = Math.ceil(this.sessions.length / this.pageSize);
    this.updatePage();
  }

  updatePage(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedSessions = this.sessions.slice(startIndex, startIndex + this.pageSize);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePage();
    }
  }

  sortBy(field: keyof Session): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }

    this.sessions.sort((a, b) => {
      if (a[field] < b[field]) return this.sortAsc ? -1 : 1;
      if (a[field] > b[field]) return this.sortAsc ? 1 : -1;
      return 0;
    });

    this.updatePage();
  }
}
