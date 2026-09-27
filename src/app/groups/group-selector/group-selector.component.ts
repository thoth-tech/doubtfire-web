import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {UntypedFormControl, Validators} from '@angular/forms';
import {MatButtonToggleChange} from '@angular/material/button-toggle';
import {MatPaginator} from '@angular/material/paginator';
import {MatTableDataSource} from '@angular/material/table';
import {Subscription} from 'rxjs';
import {Group, GroupSet, UnitRole, UserService} from 'src/app/api/models/doubtfire-model';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';
import {GroupService} from 'src/app/api/services/group.service';
import {EntityFormComponent} from 'src/app/common/entity-form/entity-form.component';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';

@Component({
  selector: 'f-group-selector',
  templateUrl: './group-selector.component.html',
  styleUrls: ['./group-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class GroupSelectorComponent
  extends EntityFormComponent<Group>
  implements OnInit, OnChanges, OnDestroy
{
  @Input() unit: Unit;
  @Input() unitRole: UnitRole;
  @Input() project: Project;
  @Input() selectedGroup: Group;
  @Input() selectedGroupSet: GroupSet;
  // The unit administration page picks the group set itself, so it turns this off.
  @Input() showGroupSetSelector = true;
  @Input() onSelect: (group: Group) => void;
  @Output() selectedGroupSetChange: EventEmitter<GroupSet> = new EventEmitter();

  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
  @ViewChild('newGroupInput') newGroupInput?: ElementRef<HTMLInputElement>;
  @ViewChild('newGroupButton', {read: ElementRef}) newGroupButton?: ElementRef<HTMLElement>;

  public groups: Group[] = [];

  public searchText = '';
  public newGroupName = '';
  public creatingGroup = false;
  public staffTutorialFilter: 'all' | 'mine' = 'all';

  private groupsSub?: Subscription;

  constructor(
    private userService: UserService,
    private groupService: GroupService,
    private alertService: AlertService,
    private confirmationModal: ConfirmationModalService,
  ) {
    super(
      {
        name: new UntypedFormControl('', [Validators.required]),
        tutorial: new UntypedFormControl(null, [Validators.required]),
        capacityAdjustment: new UntypedFormControl('', [Validators.required]),
      },
      'Group',
    );
    this.dataSource = new MatTableDataSource<Group>([]);
  }

  public get canChooseGroupSet(): boolean {
    return this.showGroupSetSelector !== false && (this.unit?.groupSets.length ?? 0) > 1;
  }

  public get canCreateGroup(): boolean {
    return (
      !!this.selectedGroupSet &&
      (!!this.unitRole || this.selectedGroupSet.allowStudentsToCreateGroups)
    );
  }

  public get displayedColumns(): string[] {
    return this.unitRole
      ? ['name', 'tutorial', 'capacity_adjustment', 'members', 'actions']
      : ['name', 'tutorial', 'members', 'actions'];
  }

  public get hasFilters(): boolean {
    return !!this.searchText.trim() || this.staffTutorialFilter !== 'all';
  }

  ngOnInit(): void {
    this.dataSource.paginator = this.paginator;

    // Keep a set the parent chose. This used to be overwritten with the first set, so
    // picking the second set in unit administration still listed the first set's groups.
    if (!this.selectedGroupSet && this.unit?.groupSets.length > 0) {
      this.selectedGroupSet = this.unit.groupSets[0];
    }

    this.refreshGroups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const setChange = changes['selectedGroupSet'];
    const unitChange = changes['unit'];
    if ((!setChange || setChange.firstChange) && (!unitChange || unitChange.firstChange)) {
      return;
    }

    if (!this.selectedGroupSet || this.selectedGroupSet.unit?.id !== this.unit?.id) {
      this.selectedGroupSet = this.unit?.groupSets[0];
    }

    this.cancelEdit();
    this.closeNewGroup();
    this.refreshGroups();
  }

  ngOnDestroy(): void {
    this.groupsSub?.unsubscribe();
  }

  selectGroupSet(groupSet: GroupSet) {
    this.selectedGroupSet = groupSet;
    this.cancelEdit();
    this.closeNewGroup();
    this.refreshGroups();
    this.selectedGroupSetChange.emit(groupSet);
  }

  refreshGroups() {
    this.groupsSub?.unsubscribe();
    this.groups = [];

    // The cache announces every create, edit and delete. The table used to copy the
    // groups here without redrawing, so a deleted group stayed on screen.
    this.groupsSub = this.selectedGroupSet?.groupsCache.values.subscribe((values) => {
      this.groups = [...values];
      this.applyFilters();
    });

    this.applyFilters();
  }

  applyFilters() {
    const search = this.searchText.trim().toLowerCase();
    const myUserId = this.unitRole?.user?.id;

    // A tutorial with no tutor, or a group whose tutorial is gone, used to throw here
    // and blank the list as soon as My tutorials was picked.
    const filteredGroups = this.groups
      .filter(
        (group) =>
          this.staffTutorialFilter === 'all' ||
          (myUserId != null && group.tutorial?.tutor?.id === myUserId),
      )
      .filter((group) => !search || (group.name ?? '').toLowerCase().includes(search));

    this.dataSource.data = filteredGroups.sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? '', undefined, {numeric: true}),
    );
  }

  clearFilters() {
    this.searchText = '';
    this.staffTutorialFilter = 'all';
    this.applyFilters();
  }

  onTutorialFilterChange(event: MatButtonToggleChange) {
    this.staffTutorialFilter = event.value;
    this.applyFilters();
  }

  openNewGroup() {
    this.newGroupName = '';
    this.creatingGroup = true;
    // The field only exists after the next render, so move focus to it then.
    setTimeout(() => this.newGroupInput?.nativeElement.focus());
  }

  closeNewGroup(returnFocus = false) {
    const wasOpen = this.creatingGroup;
    this.newGroupName = '';
    this.creatingGroup = false;

    // Cancel removes the button that had focus, so hand focus back to New group.
    if (returnFocus && wasOpen) {
      setTimeout(() => this.newGroupButton?.nativeElement.focus());
    }
  }

  addGroup(name: string) {
    if (!this.selectedGroupSet) {
      return;
    }

    if (this.unit.tutorials.length == 0) {
      this.alertService.error(
        `Please ensure there is at least one tutorial before groups are created`,
        6000,
      );
      return;
    }

    let tutorialId: number;
    if (this.project) {
      // A student with no tutorial yet used to throw here instead of creating the group.
      tutorialId = this.project.tutorials[0]?.id ?? this.unit.tutorials[0].id;
    } else {
      const tutorName = this.unitRole?.user?.name || this.userService.currentUser.name;
      tutorialId =
        this.unit.tutorials.find((t) => t.tutor?.name === tutorName)?.id ??
        this.unit.tutorials[0].id;
    }

    const groupSet = this.selectedGroupSet;

    this.groupService
      .create(
        {
          unitId: this.unit.id,
          groupSetId: groupSet.id,
        },
        {
          cache: groupSet.groupsCache,
          constructorParams: this.unit,
          body: {
            group: {
              name: name?.trim() ?? '',
              tutorial_id: tutorialId,
            },
          },
        },
      )
      .subscribe({
        next: (group) => {
          this.alertService.success('Successfully created group', 3000);

          // The server puts a student into the group they create. Show that here too,
          // or the page offers them a Join button for their own group.
          if (this.project) {
            this.project.groupCache.add(group);
            group.projectsCache.add(this.project);
          }

          // Someone may have moved to another set while this was saving. Only open the
          // new group if its set is still the one on screen.
          if (groupSet !== this.selectedGroupSet) {
            return;
          }

          // The form, and the button that had focus, go away; hand focus to New group.
          this.closeNewGroup(true);
          this.applyFilters();
          this.selectGroup(group);
        },
        error: (error) => {
          this.alertService.error(`Failed to create group: ${error}`);
        },
      });
  }

  isPartOfGroup(project: Project, group: Group) {
    return group && project?.inGroup(group);
  }

  /** Staff can open any group. A student can only open a group they are in. */
  canSelect(group: Group): boolean {
    return !!group && (!this.project || !!this.project.inGroup(group));
  }

  capacityFor(group: Group): number | null {
    const capacity = group.groupSet?.capacity;
    return capacity == null ? null : capacity + (group.capacityAdjustment ?? 0);
  }

  public groupTutorialLabel(group: Group): string {
    return group?.tutorial?.abbreviation || 'Not assigned';
  }

  public groupCapacityLabel(group: Group): string {
    const configuredCapacity = group?.groupSet?.capacity;
    if (configuredCapacity === null || configuredCapacity === undefined) {
      return `${group?.memberCount ?? 0} members, no set limit`;
    }

    const capacity = Math.max(0, configuredCapacity + (group?.capacityAdjustment ?? 0));
    return `${group?.memberCount ?? 0} of ${capacity} places`;
  }

  public canStudentJoin(group: Group): boolean {
    return Boolean(
      this.project &&
      !this.isPartOfGroup(this.project, group) &&
      this.selectedGroupSet?.allowStudentsToManageGroups &&
      !group.locked &&
      !this.selectedGroupSet.locked &&
      group.hasSpace(),
    );
  }

  joinGroup(group: Group) {
    if (!this.project) {
      return;
    }

    if (this.isPartOfGroup(this.project, group)) {
      this.alertService.error('You are already member of this group');
      return;
    }

    group.addMember(this.project, () => {
      this.selectedGroup = group;
      this.selectGroup(group);
    });
  }

  selectGroup(group: Group) {
    if (!this.canSelect(group)) {
      // Return because we're in the student view
      return;
    }

    if (this.editing(group)) {
      return;
    }

    this.selectedGroup = group;
    this.onSelect?.(group);
  }

  deleteGroup(event: Event, group: Group) {
    event.stopPropagation();

    const members = group.memberCount;
    const who =
      members > 0
        ? ` Its ${members} ${members === 1 ? 'member' : 'members'} will no longer be in a group.`
        : '';

    // Staff can delete a group that still has members, so ask before doing it.
    this.confirmationModal.show(
      'Delete group',
      `Delete ${group.name || 'this group'}?${who} This cannot be undone.`,
      () => this.removeGroup(group),
      // Cancelling needs no message; without a handler the dialog reports it as a toast.
      () => undefined,
      'Delete group',
    );
  }

  removeGroup(group: Group) {
    this.groupService.delete(group, {cache: this.selectedGroupSet.groupsCache}).subscribe({
      next: () => {
        this.alertService.success('Deleted group', 3000);
        if (group.id === this.selectedGroup?.id) {
          // Tell the parent directly. Going through selectGroup(null) was stopped by
          // its edit check, so the members of the deleted group stayed on screen.
          this.selectedGroup = null;
          this.onSelect?.(null);
        }
      },
      error: (error) => {
        this.alertService.error(`Failed to delete group: ${error}`, 6000);
      },
    });
  }

  toggleLocked(event: Event, group: Group) {
    event.stopPropagation();

    const originalLockedState = group.locked;
    group.locked = !group.locked;

    this.groupService.update(group).subscribe({
      next: (success) => {
        group.locked = success.locked;
        this.alertService.success(`Group has been ${!group.locked ? 'un' : ''}locked`, 3000);
      },
      error: (error) => {
        this.alertService.error(`Failed to ${!group.locked ? 'un' : ''}lock group: ${error}`, 6000);
        group.locked = originalLockedState;
      },
    });
  }

  startEditGroup(event: Event, group: Group) {
    event.stopPropagation();
    this.flagEdit(group);
  }

  cancelEditGroup(event: Event) {
    event.stopPropagation();
    this.cancelEdit();
  }

  saveEdit(event: Event) {
    event.stopPropagation();

    if (this.formData.invalid) {
      this.formData.markAllAsTouched();
      return;
    }

    if (!this.hasChanges()) {
      this.cancelEdit();
      return;
    }

    // Stay in edit mode until the server answers. submit() only puts the old values
    // back after a failed save while the row is still being edited, and leaving edit
    // mode straight away used to keep the rejected values on screen.
    super.submit(this.groupService, this.alertService, this.onSuccess.bind(this));
  }

  onSuccess(): void {
    this.refreshGroups();
  }

  sameEntity(a: {id: number} | null, b: {id: number} | null): boolean {
    return a === b || (!!a && !!b && a.id === b.id);
  }
}
