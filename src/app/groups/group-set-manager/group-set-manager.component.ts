import { Component, Input, Inject } from '@angular/core';
import { GradeService } from './grade.service';
import { AlertService } from './alert.service';
@Component({
  selector: 'group-set-manager',
  templateUrl: 'group-set-manager.component.html',
  styleUrls: ['group-set-manager.component.scss'],
})


export class GroupSetManagerComponent {
  @Input() unit: any;
  @Input() unitRole: any;
  @Input() project: any;
  @Input() selectedGroupSet: any;
  @Input() showGroupSetSelector: boolean = false;

  showMemberPanelToolbar: boolean = false;
  selectedStudent: any;
  selectedGroup: any;

  constructor(
    private newGroupService: NewGroupService, // Update this
    private gradeService: GradeService,
    private alertService: AlertService
  ) {}

  ngOnInit() {
    if (!this.unitRole && !this.project) {
      throw new Error("Group set group manager must have exactly one unit role or project");
    }
  }

  newGroupSelected() {
    if (this.unitRole) {
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
    this.newGroupService.update({
      unitId: this.unit.id,
      groupSetId: this.selectedGroupSet.id,
      id: this.selectedGroup.id,
    }, {
      entity: data
    }).subscribe({
      next: (response: any) => {
        this.alertService.add("success", "Group changed", 2000);
      },
      error: (response: any) => {
        this.alertService.add("danger", response, 6000);
      }
    });
  }
}
