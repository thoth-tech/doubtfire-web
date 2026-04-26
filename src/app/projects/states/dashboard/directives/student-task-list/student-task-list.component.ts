import { Component, Input } from '@angular/core';
import { GradeService } from 'src/app/common/services/grade.service';

@Component({
  selector: 'student-task-list',
  templateUrl: './student-task-list.component.html',
  styleUrls: ['./student-task-list.component.scss'],
})
export class StudentTaskListComponent {
  @Input() project: any;
  @Input() taskData: any;
  @Input() refreshTasks: any;

  filteredTasks: any[] = [];
  filters: any = {
    taskName: null
  };
  showCreatePortfolio: boolean = false;
  gradeNames: any;

  constructor(private gradeService: GradeService) {
    // Expose grade service names - handle case where service might not be ready
    try {
      this.gradeNames = this.gradeService.grades;
    } catch (error) {
      console.warn('GradeService not available:', error);
      this.gradeNames = {};
    }
  }

  ngOnInit() {
    console.log('StudentTaskList - ngOnInit called', {
      project: this.project,
      taskData: this.taskData
    });
    
    // Check taskData exists
    if (!this.taskData) {
      throw new Error("Invalid taskData provided. Must wrap the selectedTask and selectedTaskAbbr");
    }
    
    // Sort the tasks according to priority
    if (this.project) {
      this.project.calcTopTasks();
      console.log('StudentTaskList - project has activeTasks method:', !!this.project.activeTasks);
    }
    
    // Apply filters first-time
    this.applyFilters();
  }

  applyFilters() {
    console.log('StudentTaskList - applyFilters called', {
      project: this.project,
      hasActiveTasks: !!this.project?.activeTasks,
      filters: this.filters
    });
    
    if (this.project && this.project.activeTasks) {
      let tasks = this.project.activeTasks();
      console.log('StudentTaskList - raw tasks:', tasks);
      
      // Filter by task name if provided
      if (this.filters.taskName) {
        const searchTerm = this.filters.taskName.toLowerCase();
        tasks = tasks.filter(task => 
          task.definition.name.toLowerCase().includes(searchTerm) ||
          task.definition.abbreviation.toLowerCase().includes(searchTerm)
        );
      }
      
      // Sort by topWeight
      tasks.sort((a, b) => (b.topWeight || 0) - (a.topWeight || 0));
      
      this.filteredTasks = tasks;
      console.log('StudentTaskList - filtered tasks:', this.filteredTasks);
    } else {
      console.log('StudentTaskList - no project or activeTasks');
      this.filteredTasks = [];
    }
    
    this.showCreatePortfolio = !this.filters.taskName || 
      'create portfolio'.indexOf(this.filters.taskName.toLowerCase()) >= 0;
  }

  taskNameChanged() {
    this.applyFilters();
  }

  setSelectedTask(task: any) {
    // Clicking on already selected task will disable that selection
    if (this.isSelectedTask(task)) {
      task = null;
    }
    this.taskData.selectedTask = task;
    if (this.taskData.onSelectedTaskChange) {
      this.taskData.onSelectedTaskChange(task);
    }
    if (task) {
      this.scrollToTaskInList(task);
    }
  }

  scrollToTaskInList(task: any) {
    const taskEl = document.querySelector("#" + task.taskKeyToIdString()) as any;
    if (!taskEl) return;
    
    if (taskEl.scrollIntoViewIfNeeded) {
      taskEl.scrollIntoViewIfNeeded({behavior: 'smooth'});
    } else if (taskEl.scrollIntoView) {
      taskEl.scrollIntoView({behavior: 'smooth'});
    }
  }

  isSelectedTask(task: any): boolean {
    return task && this.taskData?.selectedTask &&
      task.definition.id === this.taskData.selectedTask.definition.id;
  }

  nearEnd(): boolean {
    if (!this.project || !this.project.unit) return false;
    const lateDate = new Date(this.project.unit.endDate); // Get end date as date
    lateDate.setDate(lateDate.getDate() - 21); // subtract 21 days
    return new Date() > lateDate;
  }

  trackByTaskId(index: number, task: any): any {
    return task.id || task.definition.abbreviation;
  }

  getGradeName(targetGrade: number): string {
    if (!this.gradeNames || !this.gradeNames[targetGrade]) {
      return 'Grade';
    }
    return this.gradeNames[targetGrade];
  }
}
