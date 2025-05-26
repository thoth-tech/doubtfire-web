import { Component, Input, OnInit } from '@angular/core';
import { StateService } from '@uirouter/angular';
import { ProjectService } from 'src/app/api/services/project.service';
import { Project } from 'src/app/api/models/project';
import { Unit } from 'src/app/api/models/unit';
import { GroupSet } from 'src/app/api/models/doubtfire-model';

@Component({
  selector: 'fProjectsStatesGroups',
  templateUrl: './groups.component.html',
})
export class ProjectsStatesGroupsComponent implements OnInit {
  @Input() projectId: number;

  project: Project;
  unit: Unit;
  selectedGroupSet: GroupSet;
  pageTitle: string = '';
  task: string = '';
  roleWhiteList: string[] = [];
  loading: boolean = true;

  constructor(
    private stateService: StateService,
    private projectService: ProjectService,
  ) {}

  ngOnInit(): void {
    this.projectService.fetch(this.projectId).subscribe({
      next: (project) => {
        this.project = project;
        this.unit = project.unit;

        // Set metadata from current route
        const currentState = this.stateService.current;
        this.pageTitle = currentState.data.pageTitle;
        this.task = currentState.data.task;
        this.roleWhiteList = currentState.data.roleWhiteList;

        this.loading = false;
      },
      error: (error) => {
        console.error('Error fetching project:', error);
        this.loading = false;
      },
    });
  }

  hasGroupWork(): boolean {
    return this.unit?.hasGroupwork?.() ?? false;
  }
}
