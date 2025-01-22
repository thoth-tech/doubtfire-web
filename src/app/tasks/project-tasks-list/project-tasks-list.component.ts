import { Component, Input, OnInit } from '@angular/core';
import { Project, Task } from 'src/app/api/models/doubtfire-model';

@Component({
  selector: 'f-project-tasks-list',
  templateUrl: './project-tasks-list.component.html',
  styleUrls: ['./project-tasks-list.component.scss'],
})
export class FProjectTasksListComponent implements OnInit {
  @Input() project!: Project;
  selectedTask: Task | null = null;
  sortedTasks: Task[] = [];

  ngOnInit() {
    if (this.project && this.project.tasks) {
      this.sortedTasks = this.sortTasks([...this.project.tasks]);
    }
    console.log('Project tasks:', this.sortedTasks);
  }

  sortTasks(tasks: Task[]): Task[] {
    return tasks.sort((a, b) => {
      const gradeA = a.definition.targetGrade || '';
      const gradeB = b.definition.targetGrade || '';

      // If both grades are numbers, compare them as numbers
      if (!isNaN(Number(gradeA)) && !isNaN(Number(gradeB))) {
        return Number(gradeA) - Number(gradeB);
      }

      // Otherwise, compare them as strings
      const gradeComparison = gradeA.toString().localeCompare(gradeB.toString());
      if (gradeComparison !== 0) {
        return gradeComparison;
      }

      return (a.definition.seq || 0) - (b.definition.seq || 0);
    });
  }

  taskText(task: Task): string {
    const name = task.definition?.name || 'Unnamed Task';
    const assignmentMatch = name.match(/Assignment\s*(\d+)/i);
    const testMatch = name.match(/Test\s*(\d+)/i);

    if (assignmentMatch) {
      return `A${assignmentMatch[1]}`;
    } else if (testMatch) {
      return `T${testMatch[1]}`;
    }

    const match = name.match(/(\d+\.\d+)\s*-\s*([A-Za-z\s]+)/);
    if (match) {
      const number = match[1];
      const level = this.getLevelFromName(name);
      return `${number}${level}`;
    }

    return name;
  }

  getLevelFromName(name: string): string {
    if (name.includes('Pass')) return 'P';
    if (name.includes('Credit')) return 'C';
    if (name.includes('Distinction')) return 'D';
    if (name.includes('High Distinction')) return 'HD';
    return '';
  }

  selectTask(task: Task): void {
    this.selectedTask = this.selectedTask === task ? null : task;
  }

  getStatusClass(task: Task): string {
    let statusClass = 'task-status';
    switch (task.status) {
      case 'complete':
        statusClass += ' complete';
        break;
      case 'working_on_it':
        statusClass += ' doing';
        break;
      case 'discuss':
        statusClass += ' discuss';
        break;
      case 'ready_for_feedback':
        statusClass += ' ready-for-feedback';
        break;
      case 'need_help':
        statusClass += ' need-help';
        break;
      case 'fail':
        statusClass += ' fail';
        break;
      case 'time_exceeded':
        statusClass += ' time-exceeded';
        break;
      case 'fix_and_resubmit':
        statusClass += ' fix-and-resubmit';
        break;
      case 'demonstrate':
        statusClass += ' demonstrate';
        break;
      case 'redo':
        statusClass += ' redo';
        break;
      case 'feedback_exceeded':
        statusClass += ' feedback-exceeded';
        break;
      default:
        statusClass += ' not-started';
    }
    if (this.selectedTask === task) {
      statusClass += ' selected';
    }
    return statusClass;
  }

  getTooltipText(task: Task): string {
    const statusNames: { [key: string]: string } = {
      ready_for_feedback: 'Ready for Feedback',
      not_started: 'Not Started',
      working_on_it: 'Working On It',
      need_help: 'Need Help',
      redo: 'Redo',
      feedback_exceeded: 'Feedback Exceeded',
      resubmit: 'Resubmit',
      discuss: 'Discuss',
      demonstrate: 'Demonstrate',
      complete: 'Complete',
      fail: 'Fail',
      time_exceeded: 'Time Exceeded'
    };

    const statusDisplayName = statusNames[task.status] || task.status;
    const taskDefinitionName = task.definition?.name || 'Unnamed Task';

    return `<strong>${taskDefinitionName}</strong>:<br>${statusDisplayName}`;
  }

  toggleTooltip(task: Task): void {
    task.showTooltip = !task.showTooltip;
  }

  getPlainTooltipText(task: Task): string {
    const statusNames: { [key: string]: string } = {
      ready_for_feedback: 'Ready for Feedback',
      not_started: 'Not Started',
      working_on_it: 'Working On It',
      need_help: 'Need Help',
      redo: 'Redo',
      feedback_exceeded: 'Feedback Exceeded',
      resubmit: 'Resubmit',
      discuss: 'Discuss',
      demonstrate: 'Demonstrate',
      complete: 'Complete',
      fail: 'Fail',
      time_exceeded: 'Time Exceeded'
    };

    const statusDisplayName = statusNames[task.status] || task.status;
    const taskDefinitionName = task.definition?.name || 'Unnamed Task';

    return `${taskDefinitionName}: ${statusDisplayName}`;
  }

  getStatusDisplayName(task: Task): string {
    const statusNames: { [key: string]: string } = {
      ready_for_feedback: 'Ready for Feedback',
      not_started: 'Not Started',
      working_on_it: 'Working On It',
      need_help: 'Need Help',
      redo: 'Redo',
      feedback_exceeded: 'Feedback Exceeded',
      resubmit: 'Resubmit',
      discuss: 'Discuss',
      demonstrate: 'Demonstrate',
      complete: 'Complete',
      fail: 'Fail',
      time_exceeded: 'Time Exceeded'
    };

    return statusNames[task.status] || task.status;
  }
}
