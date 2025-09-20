import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxChartsModule } from '@swimlane/ngx-charts';

interface DashboardStats {
  sessionsTotal: number;
  minutesTotal: number;
  tasksReviewed: number;
}

interface RecentSession {
  id: number;
  startTime: Date;
  durationMinutes: number;
  isActive: boolean;
}

interface TaskSummary {
  taskLabel: string;
  minutesSpent: number;
  reviewCount: number;
  avgPerReview: number;
}

interface SessionEvent {
  action: string;
  durationMinutes?: number;
  createdAt: Date;
  projectId?: string;
  taskId?: string;
}

interface SessionAssessment {
  student: string;
  task: string;
  durationMinutes: number;
  start: Date;
  end: Date;
}

@Component({
  selector: 'f-tutor-time-dashboard',
  standalone: true,
  imports: [CommonModule, NgxChartsModule],
  templateUrl: './tutor-time-dashboard.component.html',
  styleUrls: ['./tutor-time-dashboard.component.css']
})
export class TutorTimeDashboardComponent implements OnInit {
  dashboardStats: DashboardStats[] = [];
  recentSessions: RecentSession[] = [];
  taskSummary: TaskSummary[] = [];
  sessionEvents: SessionEvent[] = [];
  sessionAssessments: SessionAssessment[] = [];

  selectedSessionId?: number;
  showDetails = false;

  // chart options
  view: [number, number] = [600, 300];
  colorScheme = { domain: ['#1976d2', '#0288d1', '#ff9800', '#4caf50'] };

  // chart data
  taskChartData: { name: string; value: number }[] = [];

  ngOnInit(): void {
    this.dashboardStats = [{
      sessionsTotal: 6,
      minutesTotal: 480,
      tasksReviewed: 67
    }];

    this.recentSessions = [
      { id: 101, startTime: new Date('2025-09-15T09:00'), durationMinutes: 120, isActive: false },
      { id: 102, startTime: new Date('2025-09-16T14:00'), durationMinutes: 90, isActive: false },
      { id: 103, startTime: new Date('2025-09-17T08:00'), durationMinutes: 90, isActive: true },
      { id: 104, startTime: new Date('2025-09-18T10:00'), durationMinutes: 120, isActive: false },
      { id: 105, startTime: new Date('2025-09-19T13:00'), durationMinutes: 75, isActive: false },
      { id: 106, startTime: new Date('2025-09-20T09:00'), durationMinutes: 60, isActive: false }
    ];

    this.taskSummary = [
      { taskLabel: 'Task 1', minutesSpent: 150, reviewCount: 10, avgPerReview: 15 },
      { taskLabel: 'Task 2', minutesSpent: 90, reviewCount: 5, avgPerReview: 18 },
      { taskLabel: 'Task 3', minutesSpent: 240, reviewCount: 20, avgPerReview: 12 },
    ];

    this.taskChartData = this.taskSummary.map(t => ({
      name: t.taskLabel,
      value: t.minutesSpent
    }));
  }

  loadSessionEvents(sessionId: number): SessionEvent[] {
    if (sessionId === 101) {
      return [
        { action: 'Assessing', durationMinutes: 30, createdAt: new Date(), projectId: 'P1', taskId: 'T1' },
        { action: 'Inbox', createdAt: new Date(), projectId: 'P1', taskId: 'T2' }
      ];
    } else if (sessionId === 102) {
      return [
        { action: 'Assessing', durationMinutes: 45, createdAt: new Date(), projectId: 'P2', taskId: 'T3' },
        { action: 'Completed', createdAt: new Date() }
      ];
    }
    return [
      { action: 'Completed', createdAt: new Date() }
    ];
  }

  loadSessionAssessments(sessionId: number): SessionAssessment[] {
    if (sessionId === 101) {
      return [
        { student: 'Alice', task: 'Essay', durationMinutes: 45, start: new Date(), end: new Date() },
        { student: 'Bob', task: 'Quiz', durationMinutes: 30, start: new Date(), end: new Date() }
      ];
    } else if (sessionId === 102) {
      return [
        { student: 'Charlie', task: 'Presentation', durationMinutes: 60, start: new Date(), end: new Date() }
      ];
    }
    return [];
  }

  openDetails(sessionId: number): void {
    this.selectedSessionId = sessionId;
    this.showDetails = true;
        this.sessionEvents = [
      { action: 'Assessing', durationMinutes: 30, createdAt: new Date(), projectId: 'P1', taskId: 'T1' },
      { action: 'Inbox', createdAt: new Date(), projectId: 'P1', taskId: 'T2' },
      { action: 'Completed', createdAt: new Date() }
    ];

    this.sessionAssessments = [
      { student: 'Alice', task: 'Essay', durationMinutes: 45, start: new Date(), end: new Date() },
      { student: 'Bob', task: 'Quiz', durationMinutes: 30, start: new Date(), end: new Date() }
    ];
  }

  closeDetails(): void {
    this.showDetails = false;
    this.selectedSessionId = undefined;
  }

  formatMinutes(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }
}
