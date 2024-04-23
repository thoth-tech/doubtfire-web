import { Component, Input, OnInit } from '@angular/core';
import { Subject, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

@Component({
  selector: 'group-member-list',
  templateUrl: 'group-member-list.component.html',
  styleUrls: ['group-member-list.component.scss'],
})
export class GroupMemberListComponent implements OnInit {
  @Input() unit: any;
  @Input() project: any;
  @Input() unitRole: any;
  @Input() selectedGroup: any;
  onMembersLoaded: Subject<any> = new Subject();

  members: any[];
  canRemoveMembers: boolean = false;
  loaded: boolean = false;

  constructor(private gradeService: any,
              private alertService: any,
              private listenerService: any) {
  }

  ngOnInit(): void {
    this.loadMembers();
  }

  loadMembers(): void {
    if (!this.selectedGroup || !this.selectedGroup.id) {
      return;
    }
    this.loaded = false;
    this.selectedGroup.getMembers()
      .pipe(
        catchError((error: any) => {
          this.alertService.add("danger", "Unauthorized to view members in this group", 3000);
          return throwError(error);
        }),
        finalize(() => this.loaded = true)
      )
      .subscribe((members: any[]) => {
        this.members = members;
        this.onMembersLoaded.next(members);
        this.canRemoveMembers = this.unitRole ||
                                (this.selectedGroup.groupSet.allowStudentsToManageGroups &&
                                 !this.selectedGroup.locked);
      });
  }

  removeMember(member: any): void {
    if (!this.canRemoveMembers) {
      this.alertService.add("danger", "You do not have permission to remove members", 3000);
      return;
    }
    this.selectedGroup.removeMember(member)
      .subscribe(() => {
        this.alertService.add("success", "Member removed successfully", 3000);
        this.loadMembers();
      });
  }
}
