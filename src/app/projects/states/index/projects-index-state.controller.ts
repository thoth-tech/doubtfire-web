import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from 'src/app/api/services/project.service';
import { Project } from 'src/app/api/models/doubtfire-model';
import { GlobalStateService, ViewType } from './global-state.service';

@Component({
    selector: 'app-projects-index-state',
    templateUrl: './index.tpl.html'
})
export class ProjectsIndexStateCtrl {
    projectId: number;
    project: Project | null = null;
    unit: any;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private projectService: ProjectService,
        private globalStateService: GlobalStateService
    ) {
        this.route.params.subscribe(params => {
            this.projectId = +params['projectId'];
            if (!this.projectId) {
                this.router.navigate(['home']);
            } else {
                this.loadProject();
            }
        });
    }

    loadProject() {
        this.projectService.getProject(this.projectId, {
            cacheBehaviourOnGet: 'cacheQuery'
        }).subscribe({
            next: (project: Project | null) => {
                this.project = project;
                this.unit = project?.unit;
                this.globalStateService.setView(ViewType.PROJECT, this.project ?? undefined);
                if (!this.project) {
                    this.router.navigate(['home']);
                }
            },
            error: () => {
                this.router.navigate(['home']);
            }
        });
    }
}