import { Component, Input, Inject, OnInit } from '@angular/core';
import { GroupService } from 'src/app/api/services/group.service';
import { gradeService, alertService } from 'src/app/ajs-upgraded-providers';
import { Unit } from '../../api/models/doubtfire-model';
import { UnitRole } from '../../api/models/doubtfire-model';
import { Project } from '../../api/models/doubtfire-model';
import { GroupSet } from '../../api/models/doubtfire-model';

@Component({
  selector: 'f-app-group-set-manager',
  templateUrl: 'group-set-manager.component.html',
  styleUrls: ['./group-set-manager.component.scss'],
})
export class GroupSetManagerComponent implements OnInit {
  @Input() unit: Unit;
  @Input() unitRole: UnitRole;
  @Input() project: Project;
  @Input() selectedGroupSet: GroupSet;
  @Input() showGroupSetSelector: boolean = true;

  selectedStudent: any;
  selectedGroup: any;
  showMemberPanelToolbar: boolean = false;

  public grades: { names: any };

  constructor(
    @Inject(GroupService) private groupService: any,
    @Inject(gradeService) private GradeService: any,
    @Inject(alertService) private alerts: any,
  ) {
    this.grades = {
      names: GradeService.grades,
    };
  }

  ngOnInit(): void {
    console.log('confirmation-model ngOnInit()');
  }

  newGroupSelected() {
    if (this.unitRole || this.project) {
      this.showMemberPanelToolbar = false;
    }
  }

  groupMembersLoaded() {
    if (this.unitRole) {
      this.showMemberPanelToolbar = true;
    }
  }

  addMember(member: any) {
    this.selectedGroup.addMember(member);
    this.selectedStudent = null;
  }

  updateGroup(data: any) {
    this.groupService
      .update(
        {
          unitId: this.unit.id,
          groupSetId: this.selectedGroupSet.id,
          id: this.selectedGroup.id,
        },
        {
          entity: data,
        },
      )
      .subscribe({
        next: (response: any) => {
          this.alerts.add('success', 'Group changed', 2000, response);
        },
        error: (response: any) => {
          this.alerts.add('danger', response, 6000);
        },
      });
  }
}
