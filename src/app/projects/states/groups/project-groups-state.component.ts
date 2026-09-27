import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable, Subscription, of} from 'rxjs';
import {GroupSet, Project} from 'src/app/api/models/doubtfire-model';

@Component({
  selector: 'f-project-groups-state',
  templateUrl: './project-groups-state.component.html',
  styleUrls: ['./project-groups-state.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ProjectGroupsStateComponent implements OnInit, OnDestroy {
  @Input() public project$: Observable<Project>;

  public project: Project;
  public selectedGroupSet: GroupSet;

  private projectSub?: Subscription;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.project$ = this.project$ ?? of(this.route.parent?.snapshot.data.project as Project);

    this.projectSub = this.project$?.subscribe((project) => {
      if (!project) {
        return;
      }

      this.project = project;
      const groupSets = project.unit?.groupSets ?? [];
      const selectedGroupSetStillBelongsToUnit = groupSets.some(
        (groupSet) => groupSet.id === this.selectedGroupSet?.id,
      );
      const projectGroupSetId = project.groups.find((group) => group.groupSet)?.groupSet?.id;

      this.selectedGroupSet = selectedGroupSetStillBelongsToUnit
        ? groupSets.find((groupSet) => groupSet.id === this.selectedGroupSet.id)
        : (groupSets.find((groupSet) => groupSet.id === projectGroupSetId) ??
          groupSets.find((groupSet) => groupSet.groups.length > 0) ??
          groupSets.find((groupSet) => groupSet.allowStudentsToCreateGroups && !groupSet.locked) ??
          groupSets[0]);
    });
  }

  ngOnDestroy(): void {
    this.projectSub?.unsubscribe();
  }
}
