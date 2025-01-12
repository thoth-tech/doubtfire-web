import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'group-member-list',
  templateUrl: './group-member-list.component.html',
  styleUrls: ['./group-member-list.component.scss'],
})
export class GroupMemberListComponent implements OnInit {
  @Input() unit: any;
  @Input() project: any;
  @Input() unitRole: boolean = false;
  @Input() selectedGroup: any;
  @Input() onMembersLoaded?: () => void;

  loaded: boolean = false;
  canRemoveMembers: boolean = false;
  tableSort = {
    order: 'student_name',
    reverse: false,
  };

  constructor() {}

  ngOnInit(): void {
    this.setupListeners();
  }

  setupListeners(): void {
    if (this.selectedGroup?.id) {
      this.startLoading();
      this.canRemoveMembers =
        this.unitRole ||
        (this.selectedGroup.groupSet.allowStudentsToManageGroups &&
          !this.selectedGroup.locked);

      this.selectedGroup.getMembers().subscribe({
        next: () => {
          this.finishLoading();
        },
        error: () => {
          setTimeout(() => {
            alert('Unauthorized to view members in this group');
            this.selectedGroup = null;
          }, 1000);
        },
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

  sortTableBy(column: string): void {
    this.tableSort.order = column;
    this.tableSort.reverse = !this.tableSort.reverse;
  }

  removeMember(member: any): void {
    this.selectedGroup.removeMember(member);
  }
}
