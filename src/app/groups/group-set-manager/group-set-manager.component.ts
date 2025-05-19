import { Component, Input, OnInit } from '@angular/core';
import { GroupService } from 'src/app/api/services/group.service';
import { GradeService } from 'src/app/common/services/grade.service';
import { AlertService } from 'src/app/common/services/alert.service';

@Component({
  selector: 'group-set-manager',
  templateUrl: './group-set-manager.component.html',
  styleUrls: ['./group-set-manager.component.scss']
})
export class GroupSetManagerComponent implements OnInit {
  @Input() unit: any;
  @Input() unitRole: any;
  @Input() project: any;
  @Input() selectedGroupSet: any;
  @Input() showGroupSetSelector: boolean = false;

  selectedGroup: any = null;
  showMemberPanelToolbar: boolean = false;
  selectedStudent: any = null;

  constructor(
    private groupService: GroupService,
    private gradeService: GradeService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    if (!this.unitRole && !this.project) {
      throw new Error("Group set manager must have exactly one unit role or project");
    }

    console.log("Component initialized with:", {
      unit: this.unit,
      unitRole: this.unitRole,
      project: this.project,
      selectedGroupSet: this.selectedGroupSet,
      showGroupSetSelector: this.showGroupSetSelector
    });
  }

  newGroupSelected(group: any): void {
    this.selectedGroup = group;
    if (this.unitRole) {
      this.showMemberPanelToolbar = true;
    }
  }

  groupMembersLoaded(): void {
    if (this.unitRole) {
      this.showMemberPanelToolbar = true;
    }
  }

  addMember(): void {
    if (this.selectedGroup && this.selectedStudent) {
      this.selectedGroup.addMember(this.selectedStudent);
      this.selectedStudent = null;
    }
  }

  updateGroup(data: any): void {
    if (!this.unit || !this.selectedGroupSet || !this.selectedGroup || !this.project) {
      console.error("Unit, group set, selected group, or project is missing");
      return;
    }

    this.groupService.update(
      {
        unitId: this.unit.id,
        groupSetId: this.selectedGroupSet.id,
        projectId: this.project.id, // <-- Make sure this is correct
        id: this.selectedGroup.id,
      },
      {
        entity: data
      }
    ).subscribe({
      next: () => {
        this.alertService.success("Group changed", 2000);
      },
      error: (response) => {
        this.alertService.error(response, 6000);
      }
    });
  }

}
