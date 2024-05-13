import { Component, Input, OnInit, OnChanges, SimpleChanges, Inject } from '@angular/core';
import { GroupService } from 'src/app/api/services/group.service';
import { alertService } from 'src/app/ajs-upgraded-providers';
import { Unit, UnitRole, Project, GroupSet } from '../../api/models/doubtfire-model';

@Component({
  selector: 'app-group-member-list',
  templateUrl: './group-member-list.component.html',
  styleUrls: ['./group-member-list.component.css']
})
export class GroupMemberListComponent implements OnInit, OnChanges {
  @Input() unit: Unit;
  @Input() unitRole: UnitRole;
  @Input() project: Project;
  @Input() selectedGroupSet: GroupSet;

  members: any[] = [];  // Assuming 'members' are stored in this array
  loaded: boolean = false;
  tableSort: { order: string, reverse: boolean } = { order: 'student_name', reverse: false };

  constructor(
    private groupService: GroupService,
    @Inject('alertService') private alertService: any  // Use AngularJS service in Angular
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
  }

  startLoading(): void {
    this.loaded = false;
    setTimeout(() => {
      this.loaded = true;
    }, 500);
  }

  removeMember(member: any): void {
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


