import { Component, Input, OnInit, OnChanges, SimpleChanges, Inject } from '@angular/core';
import { GroupService } from 'src/app/api/services/group.service';
import { alertService } from 'src/app/ajs-upgraded-providers';
import { Unit, UnitRole, Project, GroupSet } from '../../api/models/doubtfire-model';
import { Group } from '../../api/models/groups/group';

interface Member {
  student: {
    username: string;
    name: string;
  };
  targetGrade: string;
  id: number;
}

@Component({
  selector: 'app-group-member-list',
  templateUrl: './group-member-list.component.html',
  styleUrls: ['./group-member-list.component.scss']
})
export class GroupMemberListComponent implements OnInit, OnChanges {
  @Input() unit: Unit;
  @Input() unitRole: UnitRole;
  @Input() project: Project;
  @Input() selectedGroup: Group;

  members: Member[] = [];
  loaded: boolean = false;
  tableSort: { order: string, reverse: boolean } = { order: 'student_name', reverse: false };
  canRemoveMembers: boolean = false;

  constructor(
    private groupService: GroupService,
    @Inject('alertService') private alertService: any
  ) { }

  ngOnInit(): void {
    this.checkGroupAndLoadMembers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.selectedGroup) {
      this.checkGroupAndLoadMembers();
    }
  }

  checkGroupAndLoadMembers(): void {
    if (this.selectedGroup?.id) {
      this.startLoading();
      this.canRemoveMembers = !!this.unitRole || (this.selectedGroup.groupSet.allowStudentsToManageGroups && !this.selectedGroup.locked);

      this.selectedGroup.getMembers().subscribe({
        next: (projects) => {
          this.members = projects.map(project => ({
            student: {
              username: project.student.username,
              name: project.student.name
            },
            targetGrade: project.targetGrade.toString(),
            id: project.id
          }));
          this.finishLoading();
        },
        error: (failure) => {
          setTimeout(() => {
            this.alertService.add("danger", "Unauthorized to view members in this group", 3000);
            this.selectedGroup = null;
          }, 1000);
        }
      });
    }
  }

  startLoading(): void {
    this.loaded = false;
  }

  finishLoading(): void {
    setTimeout(() => {
      this.loaded = true;
      if (this.onMembersLoaded) {
        this.onMembersLoaded();
      }
    }, 500);
  }

  removeMember(member: Member): void {
    this.groupService.removeMember(this.selectedGroup, member.id).subscribe({
      next: () => {
        this.alertService.success('Member successfully removed');
        this.members = this.members.filter(m => m.id !== member.id);
      },
      error: (error) => {
        this.alertService.error('Error removing member: ' + error.message);
      }
    });
  }

  sortTableBy(order: string): void {
    if (this.tableSort.order === order) {
      this.tableSort.reverse = !this.tableSort.reverse;
    } else {
      this.tableSort.order = order;
      this.tableSort.reverse = false;
    }
  }

  @Input() onMembersLoaded?: () => void;
}
