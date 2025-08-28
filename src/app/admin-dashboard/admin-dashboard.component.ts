import { Component, OnInit } from '@angular/core';
import { TutorSession } from './session-data.model'; // adjust path if needed
import { MOCK_SESSIONS } from './mock-session-data'; // adjust path if needed

@Component({
  selector: 'admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  sessions: TutorSession[] = [];
  filteredSessions: TutorSession[] = [];
  chartData: any[] = [];

  // Filters
  selectedTutor: string = 'All';
  selectedUnit: string = 'All';
  selectedProject: string = 'All';
  dateFrom?: Date;
  dateTo?: Date;

  // Table columns
  displayedColumns: string[] = ['tutorName', 'unitName', 'projectName', 'durationMinutes', 'tasksMarked'];

  // Chart color scheme
  colorScheme = {
    domain: ['#43a047', '#c62828', '#1e88e5', '#ffb300']
  };

  ngOnInit(): void {
    this.sessions = MOCK_SESSIONS;
    this.applyFilters();
  }

  // Filter and update both chart and table
  applyFilters(): void {
    this.filteredSessions = this.sessions.filter(session => {
      const matchesTutor = this.selectedTutor === 'All' || session.tutorName === this.selectedTutor;
      const matchesUnit = this.selectedUnit === 'All' || session.unitName === this.selectedUnit;
      const matchesProject = this.selectedProject === 'All' || session.projectName === this.selectedProject;

      const sessionDate = new Date(session.sessionStart);
      const matchesDateFrom = !this.dateFrom || sessionDate >= this.dateFrom;
      const matchesDateTo = !this.dateTo || sessionDate <= this.dateTo;

      return matchesTutor && matchesUnit && matchesProject && matchesDateFrom && matchesDateTo;
    });

    this.updateChartData();
  }

  // Convert to ngx-charts format
  updateChartData(): void {
    const durationByTutor: { [tutorName: string]: number } = {};

    this.filteredSessions.forEach(session => {
      if (!durationByTutor[session.tutorName]) {
        durationByTutor[session.tutorName] = 0;
      }
      durationByTutor[session.tutorName] += session.durationMinutes;
    });

    this.chartData = Object.keys(durationByTutor).map(tutor => ({
      name: tutor,
      value: durationByTutor[tutor]
    }));
  }

  // Unique filter values
  getUniqueTutors(): string[] {
    return [...new Set(this.sessions.map(s => s.tutorName))];
  }

  getUniqueUnits(): string[] {
    return [...new Set(this.sessions.map(s => s.unitName))];
  }

  getUniqueProjects(): string[] {
    return [...new Set(this.sessions.map(s => s.projectName))];
  }
}
