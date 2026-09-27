import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import {FormControl} from '@angular/forms';
import {Subscription, first} from 'rxjs';
import {
  Group,
  GroupSet,
  Project,
  ProjectService,
  Unit,
  UnitRole,
} from 'src/app/api/models/doubtfire-model';
import {GroupService} from 'src/app/api/services/group.service';
import {AlertService} from 'src/app/common/services/alert.service';

// The add-a-student list shows this many matches at most; typing narrows it down.
const MAX_CANDIDATES = 50;

@Component({
  selector: 'f-group-set-manager',
  templateUrl: './group-set-manager.component.html',
  styleUrls: ['./group-set-manager.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class GroupSetManagerComponent implements OnInit, OnChanges, OnDestroy {
  @Input() project: Project;
  @Input() unit: Unit;
  @Input() selectedGroupSet: GroupSet;
  @Input() showGroupSetSelector: boolean;
  @Input() unitRole: UnitRole;

  public selectedGroup: Group;

  editingGroupName = false;

  control: FormControl<string | Project> = new FormControl('');

  // One function for the life of the component. A getter handed the selector a new
  // function on every check, which counted as a changed input each time.
  readonly groupSelectHandler = (group: Group) => this.newGroupSelected(group);

  private originalGroupName: string;
  private studentsSub?: Subscription;

  constructor(
    private groupService: GroupService,
    private alertService: AlertService,
    private projectService: ProjectService,
  ) {}

  ngOnInit(): void {
    this.loadStudentsForStaff();
    this.selectCurrentProjectGroup();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const unitChanged = changes['unit'] && !changes['unit'].firstChange;
    const setChanged = changes['selectedGroupSet'] && !changes['selectedGroupSet'].firstChange;

    // A group from another unit or another set must not stay open beside the new list.
    if (
      this.selectedGroup &&
      (unitChanged || (setChanged && this.selectedGroup.groupSet !== this.selectedGroupSet))
    ) {
      this.newGroupSelected(null);
    }

    if (unitChanged || (changes['unitRole'] && !changes['unitRole'].firstChange)) {
      this.loadStudentsForStaff();
    }
    if (changes['project'] || changes['selectedGroupSet']) {
      this.selectCurrentProjectGroup();
    }
  }

  ngOnDestroy(): void {
    this.studentsSub?.unsubscribe();
  }

  public get canRenameGroup(): boolean {
    return (
      !!this.selectedGroup &&
      (!!this.unitRole || !!this.selectedGroup.groupSet?.allowStudentsToManageGroups)
    );
  }

  /**
   * Students in the unit who can join the open group and match what has been typed.
   * Worked out from the current cache each time, so students who load after the
   * group was opened, and members added or removed since, are reflected.
   */
  public get memberCandidates(): Project[] {
    const group = this.selectedGroup;
    if (!group || !this.unit) {
      return [];
    }

    // The unit's filter reads the group's tutorial when groups stay in one class.
    if (group.groupSet?.keepGroupsInSameClass && !group.tutorial) {
      return [];
    }

    const value = this.control.value;
    const text = typeof value === 'string' ? value.trim().toLowerCase() : '';

    return this.unit
      .studentsForGroupTypeAhead(group)
      .filter(
        (project) =>
          !text ||
          project.student?.name?.toLowerCase().includes(text) ||
          project.student?.username?.toLowerCase().includes(text),
      )
      .slice(0, MAX_CANDIDATES);
  }

  displayFn(project: Project): string {
    return project && project.student?.name ? project.student.name : '';
  }

  onGroupSetChange(groupSet?: GroupSet): void {
    if (groupSet) {
      this.selectedGroupSet = groupSet;
    }
    this.newGroupSelected(null);
    this.selectCurrentProjectGroup();
  }

  newGroupSelected(group: Group | null) {
    // Throw away a rename that was never saved. A saved one is kept: this used to put
    // the old name back on screen as soon as another group was opened.
    if (this.selectedGroup && this.editingGroupName) {
      this.selectedGroup.name = this.originalGroupName;
    }

    this.editingGroupName = false;
    this.selectedGroup = group;
    this.originalGroupName = group?.name;
    this.control.setValue('');
  }

  addMember(project: Project) {
    this.selectedGroup.addMember(project);
    this.control.setValue('');
  }

  startEditingGroupName() {
    this.originalGroupName = this.selectedGroup.name;
    this.editingGroupName = true;
  }

  stopEditingGroupName() {
    this.selectedGroup.name = this.originalGroupName;
    this.editingGroupName = false;
  }

  updateGroup() {
    const group = this.selectedGroup;
    const previousName = this.originalGroupName;

    if (!group?.name?.trim()) {
      return;
    }

    this.editingGroupName = false;
    this.originalGroupName = group.name;

    this.groupService
      .update(
        {
          unitId: this.unit.id,
          groupSetId: group.groupSet.id,
          id: group.id,
        },
        {
          entity: group,
        },
      )
      .subscribe({
        next: () => {
          this.alertService.success('Successfully updated group', 3000);
        },
        error: (error) => {
          // Put the name back on the group that was renamed, even if another group
          // has been opened since.
          group.name = previousName;
          if (group === this.selectedGroup) {
            this.originalGroupName = previousName;
          }
          this.alertService.error(`Failed to update group: ${error}`, 6000);
        },
      });
  }

  /**
   * The add-a-student list comes from the unit's students. Opening this page straight
   * from a link or a refresh left that list empty, because only the student list page
   * fetched them. Staff fetch them here; the request is shared with that page's cache.
   */
  private loadStudentsForStaff(): void {
    if (!this.unitRole || !this.unit) {
      return;
    }

    this.studentsSub?.unsubscribe();
    this.studentsSub = this.projectService
      .loadStudents(this.unit)
      .pipe(first())
      .subscribe({
        error: () => {
          this.alertService.error(
            'Students could not be loaded, so the list of students to add may be incomplete.',
            6000,
          );
        },
      });
  }
  private selectCurrentProjectGroup(): void {
    const currentGroup = this.project?.groupForGroupSet(this.selectedGroupSet);
    if (currentGroup && currentGroup.id !== this.selectedGroup?.id) {
      this.newGroupSelected(currentGroup);
    }
  }
}
