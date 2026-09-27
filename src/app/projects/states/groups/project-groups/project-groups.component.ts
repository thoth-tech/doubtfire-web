import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {GroupSet, Project} from 'src/app/api/models/doubtfire-model';
import {Unit} from 'src/app/api/models/unit';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {
  DemoScenarioContract,
  DemoScenarioRegistryService,
} from 'src/app/demo/demo-scenario-registry.service';

// This component is only displayed to students (projects)
@Component({
  selector: 'f-project-groups',
  templateUrl: './project-groups.component.html',
  styleUrl: './project-groups.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ProjectGroupsComponent {
  @Input() unit: Unit;
  @Input() project: Project;
  @Input() selectedGroupSet: GroupSet;

  constructor(
    private demoMode: DemoModeStore,
    private demoRegistry: DemoScenarioRegistryService,
  ) {}

  public get hasConfiguredGroupWork(): boolean {
    return Boolean(this.unit?.hasGroupwork());
  }

  public get hasPublishedGroups(): boolean {
    return Boolean(this.selectedGroupSet?.groups?.length);
  }

  // A new group set starts with no groups. When students may create their own,
  // the create form in the group manager is the only way the first group gets made.
  public get studentsCanCreateGroups(): boolean {
    return Boolean(
      this.selectedGroupSet?.allowStudentsToCreateGroups && !this.selectedGroupSet.locked,
    );
  }

  public get demoGroupHook(): DemoScenarioContract['group_hook'] | null {
    const hook = this.demoMode.enabled ? this.demoRegistry.scenario?.group_hook : null;
    if (
      !hook ||
      hook.unit_id !== this.unit?.id ||
      hook.project_id !== this.project?.id ||
      hook.group_set_id !== this.selectedGroupSet?.id
    ) {
      return null;
    }

    return hook;
  }
}
