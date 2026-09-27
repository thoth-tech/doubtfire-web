import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import {Subscription} from 'rxjs';
import {Group, UnitRole} from 'src/app/api/models/doubtfire-model';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';

@Component({
  selector: 'f-group-member-list',
  templateUrl: './group-member-list.component.html',
  styleUrls: ['./group-member-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class GroupMemberListComponent implements OnChanges, OnDestroy {
  @Input() unit: Unit;
  @Input() unitRole: UnitRole;
  @Input() project: Project;
  @Input() selectedGroup: Group;
  @Input() onMembersLoaded: () => void;

  loading = false;
  loadError = false;
  members: Project[] = [];

  private membersRequest?: Subscription;
  private groupMembersSub?: Subscription;

  /**
   * Worked out when asked, not once after the members load, so locking or unlocking
   * the group while it is open changes what a student can do straight away.
   */
  public get canRemoveMembers(): boolean {
    if (this.unitRole) {
      return true;
    }

    return (
      !!this.selectedGroup?.groupSet?.allowStudentsToManageGroups && !this.selectedGroup?.locked
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedGroup']) {
      this.loadMembers();
    }
  }

  ngOnDestroy(): void {
    this.membersRequest?.unsubscribe();
    this.groupMembersSub?.unsubscribe();
  }

  public loadMembers(): void {
    // Cancel the request for the group that was open before, so a slow reply for it
    // cannot land on top of the group now on screen.
    this.membersRequest?.unsubscribe();
    this.groupMembersSub?.unsubscribe();
    this.loadError = false;
    this.members = [];

    const group = this.selectedGroup;
    if (!group) {
      this.loading = false;
      return;
    }

    this.loading = true;
    this.membersRequest = group.getMembers().subscribe({
      next: () => {
        this.loading = false;
        this.onMembersLoaded?.();

        // The group's own cache follows adds and removals made on this page.
        this.groupMembersSub = group.projectsCache.values.subscribe((values) => {
          this.members = this.sortedByName(values);
        });
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
        this.members = [];
      },
    });
  }

  public removeMember(member: Project): void {
    this.selectedGroup.removeMember(member);
  }

  private sortedByName(projects: readonly Project[]): Project[] {
    return [...projects].sort((a, b) =>
      (a.student?.name ?? '').localeCompare(b.student?.name ?? ''),
    );
  }
}
