import { Component, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Project } from 'src/app/api/models/project';
import { Unit } from 'src/app/api/models/unit';


@Component({
  selector: 'f-projects-groups-state',
  templateUrl: './groups.tpl.html'
})
export class ProjectsGroupsStateComponent {
  @Input() project!: Project;
  @Input() unit!: Unit;

  hasGroupwork(): boolean {
    return this.unit?.hasGroupwork?.() ?? false;
  }
}
