import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';

type SortKey = 'student.username' | 'student.name' | 'targetGrade';

@Component({
  selector: 'group-member-list',
  templateUrl: './group-member-list.component.html',
})
export class GroupMemberListComponent implements OnChanges {
  // Inputs from AngularJS parent (group-set-manager)
  @Input() unit: any;
  @Input() project: any;
  @Input() unitRole: any;
  @Input() selectedGroup: any;

  // Output back to AngularJS: members-loaded="groupMembersLoaded()"
  @Output() membersLoaded = new EventEmitter<void>();
  @Output() unitRoleChange = new EventEmitter<any>();


  loaded = false;

  tableSort: { order: SortKey; reverse: boolean } = {
    order: 'student.username',
    reverse: false,
  };

  ngOnChanges(changes: SimpleChanges): void {
    if ('selectedGroup' in changes && this.selectedGroup?.id) {
      this.fetchMembers();
    }
  }

  private fetchMembers(): void {
    this.loaded = false;

    if (this.selectedGroup?.projectsCache?.clear) {
      this.selectedGroup.projectsCache.clear();
    }

    this.selectedGroup.getMembers().subscribe({
      next: () => {
        setTimeout(() => {
          this.loaded = true;
          this.membersLoaded.emit();
        }, 300);
      },
      error: () => {
        setTimeout(() => {
          this.loaded = true;
          this.selectedGroup = null;
        }, 300);
      },
    });
  }

  get members(): any[] {
    return this.selectedGroup?.members ?? [];
  }

  get canRemoveMembers(): boolean {
    const g = this.selectedGroup;
    return !!this.unitRole || (!!g?.groupSet?.allowStudentsToManageGroups && !g?.locked);
  }

  sortTableBy(column: SortKey): void {
    if (this.tableSort.order === column) {
      this.tableSort.reverse = !this.tableSort.reverse;
    } else {
      this.tableSort.order = column;
      this.tableSort.reverse = false;
    }
  }

  get sortedMembers(): any[] {
    const list: any[] = Array.isArray(this.members) ? this.members.slice() : [];
    if (!list.length) return list;

    const path = this.tableSort.order.split('.');
    const val = (obj: any) => path.reduce((a, k) => (a == null ? a : a[k]), obj);

    list.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va == null && vb == null) return 0;
      if (va == null) return -1;
      if (vb == null) return 1;
      return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' });
    });

    return this.tableSort.reverse ? list.reverse() : list;
  }

  trackByProject = (_: number, p: any) => p?.id ?? _;

  removeMember(member: any): void {
    this.selectedGroup?.removeMember(member);
  }
}
