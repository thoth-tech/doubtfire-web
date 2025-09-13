import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  IterableDiffers,
  IterableDiffer,
  DoCheck,
} from '@angular/core';
import {Group} from 'src/app/api/models/doubtfire-model';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';
import {UnitRole} from 'src/app/api/models/unit-role';

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
    return removed?.size ? list.filter((m) => !removed.has(String(m.id))) : list;
  }

  private maybeClearRemoved(group: Group): void {
    const key = String(group.id);
    const removed = this.removedByGroup.get(key);
    if (!removed?.size) return;
    const stillPresent = [...removed].some((id) =>
      (group.members as Project[]).some((m) => String(m?.id) === id),
    );
    if (!stillPresent) this.removedByGroup.delete(key);
  }

  tableSort: {order: SortKey; reverse: boolean} = {
    order: 'student.username',
    reverse: false,
  };

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private differs: IterableDiffers,
  ) {}

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

  /**
   * Sorts the current list of group members (`this.members`)
   * based on the column chosen in `this.tableSort.order`
   * (e.g. "student.username", "student.name", "targetGrade").
   *
   * Works with nested fields (like student.username) and
   * compares values in a way that handles both text and numbers.
   * Applies ascending or descending order depending on `this.tableSort.reverse`.
   * Updates `this.sortedMembers` with the newly sorted list.
   *
   * In short,this takes the list of members
   * and arranges them alphabetically (or numerically if applicable)
   * by the selected property, so the UI can display them in the right order.
   */

  private resort(): void {
    const memberList = Array.isArray(this.members) ? [...this.members] : [];
    const propertyPath = this.tableSort.order.split('.');

    const getValueByPath = (obj: any) =>
      propertyPath.reduce((current, key) => (current == null ? current : current[key]), obj);

    memberList.sort((memberA, memberB) => {
      const valueA = getValueByPath(memberA);
      const valueB = getValueByPath(memberB);

      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return -1;
      if (valueB == null) return 1;

      return String(valueA).localeCompare(String(valueB), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });

    this.sortedMembers = this.tableSort.reverse ? memberList.reverse() : memberList;
  }

  private fetchMembers(): void {
    this.loaded = false;
    const g = this.selectedGroup!;

    g.getMembers().subscribe({
      next: () => {
        const raw = Array.isArray(g.members) ? [...(g.members as Project[])] : [];
        this.members = this.applyRemovedFilter(raw, String(g.id));
        this.resort();
        this.loaded = true;
        this.updateCanRemoveMembers();
        this.membersLoaded.emit();
        this.maybeClearRemoved(g);
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
    if (!this.selectedGroup) return;

    this.selectedGroup.removeMember(member);

    const gKey = String(this.selectedGroup.id);
    const set = this.removedByGroup.get(gKey) ?? new Set<string>();
    set.add(String(member?.id));
    this.removedByGroup.set(gKey, set);

    const fresh = Array.isArray(this.selectedGroup.members)
      ? [...(this.selectedGroup.members as Project[])]
      : [];

    this.members = this.filterMovedMembers(this.applyRemovedFilter(fresh, gKey), gKey);

    this.sortedMembers = this.sortedMembers.filter((m) => m.id !== member.id);
    this.resort();
    this.changeDetectorRef.markForCheck();
  }

  private filterMovedMembers(list: Project[], currentGroupId: string): Project[] {
    return list.filter((member) => {
      for (const [gid, removed] of this.removedByGroup.entries()) {
        if (gid !== currentGroupId && removed.has(String(member.id))) {
          return false;
        }
      }
      return true;
    });
  }
}
