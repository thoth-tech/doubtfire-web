import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef, ChangeDetectionStrategy, IterableDiffers, IterableDiffer, DoCheck } from '@angular/core';
import { Group } from 'src/app/api/models/doubtfire-model';
import { Project } from 'src/app/api/models/project';
import { Unit } from 'src/app/api/models/unit';
import { UnitRole } from 'src/app/api/models/unit-role';

type SortKey = 'student.username' | 'student.name' | 'targetGrade';

@Component({
  selector: 'group-member-list',
  templateUrl: './group-member-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupMemberListComponent implements OnChanges, DoCheck {
  // Inputs from AngularJS parent (group-set-manager)
  @Input() unit: Unit;
  @Input() project: Project;
  @Input() unitRole: UnitRole;
  @Input() selectedGroup: Group | null;

  // Output back to AngularJS: members-loaded="groupMembersLoaded()"
  @Output() membersLoaded = new EventEmitter<void>();
  @Output() unitRoleChange = new EventEmitter<UnitRole>();



  loaded = false;

  members: Project[] = [];
  sortedMembers: Project[] = [];
  canRemoveMembers = false;
  private membersDiffer: IterableDiffer<Project> | null = null;
  private removedByGroup = new Map<string, Set<string>>();

  private applyRemovedFilter(list: Project[], groupId: number | string): Project[] {
    const key = String(groupId);
    const removed = this.removedByGroup.get(key);
    return removed?.size ? list.filter(m => !removed.has(String(m.id))) : list;
  }

  private maybeClearRemoved(group: Group): void {
    const key = String(group.id);
    const removed = this.removedByGroup.get(key);
    if (!removed?.size) return;
    const stillPresent = [...removed].some(id =>
      (group.members as Project[]).some(m => String (m?.id) === id)
    );
    if (!stillPresent) this.removedByGroup.delete(key);
  }

  tableSort: { order: SortKey; reverse: boolean } = {
    order: 'student.username',
    reverse: false,
  };

  constructor(private changeDetectorRef: ChangeDetectorRef, private differs: IterableDiffers) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ('selectedGroup' in changes && this.selectedGroup?.id) {
      const current = (this.selectedGroup.members as Project[]) ?? [];
      this.membersDiffer = this.differs.find(current).create<Project>();
      this.fetchMembers();
    }
  }

  ngDoCheck(): void {
  if (this.membersDiffer && this.selectedGroup) {
    const diff = this.membersDiffer.diff(this.selectedGroup.members as Project[]);
    if (diff) {
      const gid = String(this.selectedGroup.id);
      const raw = [...(this.selectedGroup.members as Project[])];
      this.members = this.applyRemovedFilter(raw, gid);
      this.resort();
      this.maybeClearRemoved(this.selectedGroup);
      this.changeDetectorRef.markForCheck();
    }
  }
}

  private resort(): void {
    const list = Array.isArray(this.members) ? [...this.members] : [];
    const path = this.tableSort.order.split('.');
    const val = (obj: any) => path.reduce((a, k) => (a == null ? a : a[k]), obj);

    list.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va == null && vb == null) return 0;
      if (va == null) return -1;
      if (vb == null) return 1;
      return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' });
    });

    this.sortedMembers = this.tableSort.reverse ? list.reverse() : list;
  }

  private fetchMembers(): void {
    this.loaded = false;
    const g = this.selectedGroup!;
    // if (this.selectedGroup?.projectsCache?.clear) {
    //   this.selectedGroup.projectsCache.clear();
    // }

    g.getMembers().subscribe({
      next: () => {
        const raw = Array.isArray(g.members) ? [...(g.members as Project[])] : [];
        this.members = this.applyRemovedFilter(raw, String(g.id));
        this.resort();
        this.loaded = true;
        this.updateCanRemoveMembers();
        this.membersLoaded.emit();
        this.maybeClearRemoved(g)
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.loaded = true;
        this.selectedGroup = null;
        this.members = [];
        this.sortedMembers = [];
        this.canRemoveMembers = false;
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  private updateCanRemoveMembers(): void {
    const g = this.selectedGroup;
    this.canRemoveMembers =
     !!this.unitRole || (!!g?.groupSet?.allowStudentsToManageGroups && !g?.locked);
  }

  sortTableBy(column: SortKey): void {
    if (this.tableSort.order === column) {
      this.tableSort.reverse = !this.tableSort.reverse;
    } else {
      this.tableSort.order = column;
      this.tableSort.reverse = false;
    }
    this.resort();
    this.changeDetectorRef.markForCheck();
  }

  trackByProject = (_: number, p: Project) => String(p?.id ?? _);

  removeMember(member: Project): void {
      if(!this.selectedGroup) return;
      this.selectedGroup.removeMember(member);
      const gKey = String(this.selectedGroup.id);
      const set = this.removedByGroup.get(gKey) ?? new Set<string>();
      set.add(String(member?.id));
      this.removedByGroup.set(gKey, set);
      this.members = this.members.filter(m => m.id !== member.id);
      this.sortedMembers = this.sortedMembers.filter(m => m.id !== member.id);
      this.resort();
      this.changeDetectorRef.markForCheck();
  }
}
