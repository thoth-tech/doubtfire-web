import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, ParamMap } from '@angular/router';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { GlobalStateService } from './global-state.service';
import { ProjectService } from '../../services/project.service';
import { ListenerService } from '../../services/listener.service';
import { ViewType } from '../../common/types/view-type';

@Component({
  selector: 'app-projects-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})
export class ProjectsIndexComponent implements OnInit, OnDestroy {
  projectId!: number;
  project: any;
  unit: any;
  isLoading = true;
  hasError = false;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private listenerService: ListenerService,
    private globalStateService: GlobalStateService
  ) { }

  ngOnInit(): void {
    // Wait for global state to be ready, then react to route changes
    this.globalStateService.onLoad(() => {
      this.route.paramMap
        .pipe(
          takeUntil(this.destroy$),
          switchMap((params: ParamMap) => {
            const idParam = params.get('projectId');
            this.projectId = Number(idParam);

            if (!this.projectId || Number.isNaN(this.projectId)) {
              this.hasError = true;
              this.isLoading = false;
              this.router.navigate(['/home']);
              // Return an empty observable when navigation happens
              return new Subject<never>();
            }

            this.isLoading = true;
            this.hasError = false;

            return this.projectService.get(this.projectId, {
              cacheBehaviourOnGet: 'cacheQuery',
              mappingCompleteCallback: (project: any) => {
                this.unit = project?.unit;
              }
            });
          })
        )
        .subscribe({
          next: (project: any) => {
            this.project = project;

            // Guard against null/undefined project
            if (!project) {
              this.hasError = true;
              this.isLoading = false;
              this.router.navigate(['/home']);
              return;
            }

            // Ensure unit is set when tasks match task definitions
            if (
              project.unit?.taskDefinitions?.length > 0 &&
              project.tasks?.length === project.unit.taskDefinitions.length
            ) {
              this.unit = project.unit;
            }

            // Use enum for view type
            this.globalStateService.setView(ViewType.PROJECT, this.project);

            this.isLoading = false;
          },
          error: () => {
            this.isLoading = false;
            this.hasError = true;
            this.router.navigate(['/home']);
          }
        });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}