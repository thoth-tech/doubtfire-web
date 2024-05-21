import { Component, Input, OnInit, OnChanges, SimpleChanges, Inject } from '@angular/core';
import { GroupService } from 'src/app/api/services/group.service';
import { alertService } from 'src/app/ajs-upgraded-providers';
import { Unit, UnitRole, Project, GroupSet } from '../../api/models/doubtfire-model';

interface Member {
  student: {
    username: string;
    name: string;
  };
  targetGrade: string;
  id: string;
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
  @Input() selectedGroupSet: GroupSet;

  members: Member[] = [];
  loaded: boolean = false;
  tableSort: { order: string, reverse: boolean } = { order: 'student_name', reverse: false };

  constructor(
    private groupService: GroupService,
    @Inject('alertService') private alertService: any  
  ) { }

  ngOnInit(): void {
    this.loadMembers();  // Load members
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.selectedGroupSet) {
      this.loadMembers();
    }
  }

  loadMembers(): void {
    this.startLoading();
    // Implement the logic to actually load members here
  }

  startLoading(): void {
    this.loaded = false;
    setTimeout(() => {
      this.loaded = true;
    }, 500);
  }

  removeMember(member: Member): void {
    this.groupService.removeMember(member.id).subscribe({
      next: (resp) => {
        this.alertService.success('Member successfully removed');
        this.members = this.members.filter(m => m.id !== member.id);  // Update the members list
      },
      error: (error) => {
        this.alertService.error('Error removing member: ' + error.message);
      }
    });
  }
}



