import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {GroupSet} from 'src/app/api/models/doubtfire-model';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';

@Component({
  selector: 'df-projects-groups',
  templateUrl: './groups.component.html',
})
export class ProjectsGroupsComponent {
  unit: Unit;
  project: Project;
  selectedGroupSet: GroupSet;

  constructor(private route: ActivatedRoute) {
    // data.task, data.pageTitle, data.roleWhitelist available here
  }
}
