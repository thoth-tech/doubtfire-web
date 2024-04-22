import {Component, Input, OnInit} from '@angular/core';
import {Group, GroupSet, Unit, Project, Tutorial} from 'src/app/api/models/doubtfire-model';
import {Subscription, Observable} from 'rxjs';
import {GroupService} from 'src/app/api/services/group.service';

interface GroupUpdateData {
  capacityAdjustment: number;
  tutorial: Tutorial; // Assuming Tutorial is the correct type for the tutorial property
  name: string;
}

@Component({
  selector: 'f-group-selector',
  templateUrl: './group-selector.component.html',
  styleUrls: ['./group-selector.component.scss'],
})
export class GroupSelectorComponent implements OnInit {
  @Input() unit: Unit;
  @Input() project?: Project;
  @Input() unitRole?: string;
  @Input() selectedGroupSet: GroupSet;
  @Input() selectedGroup?: Group;
  @Input() showGroupSetSelector?: boolean;
  @Input() onSelect?: (group: Group) => void;

  listeners: Subscription[] = [];
  staffFilter: string | null = null;
  filteredGroups: Group[] = [];
  pagination = {
    currentPage: 1,
    maxSize: 10,
    pageSize: 10,
    totalSize: null,
    show: false,
    onChange: () => this.applyFilters(),
  };

  tableSort = {
    order: 'name',
    reverse: false,
  };
  loaded = false;
  canCreateGroups: boolean = false;
  newGroupName = '';
  shownGroups: Observable<Group[]>; // Changed to Observable<Group[]>

  constructor(private groupService: GroupService) {} // Inject GroupService

  ngOnInit() {
    this.applyFilters();
    this.selectGroupSet(this.selectedGroupSet);
  }

  applyFilters() {
    if (this.unitRole) {
      this.filteredGroups = this.selectedGroupSet.groupsInTutorials(
        this.unitRole,
        this.staffFilter,
      );
    } else {
    }

    this.filteredGroups = this.paginateAndSort(
      this.filteredGroups,
      this.pagination,
      this.tableSort,
    );
  }

  setStaffFilter(scope: string) {
    this.staffFilter = scope;
    this.applyFilters();
  }

  sortTableBy(column: string) {
    this.tableSort.order = column;
    this.tableSort.reverse = !this.tableSort.reverse;
    this.applyFilters();
  }

  startLoading() {
    this.loaded = false;
  }

  finishLoading() {
    setTimeout(() => {
      this.loaded = true;
      if (this.project) {
        this.selectGroup(this.project.groupForGroupSet(this.selectedGroupSet));
      }
    }, 500);
  }

  selectGroup(group: Group) {
    if (this.project && !this.project.inGroup(group)) {
      return;
    }
    this.selectedGroup = group;
    if (this.onSelect) {
      this.onSelect(group);
    }
  }

  resetNewGroupForm() {
    this.newGroupName = '';
  }

  selectGroupSet(groupSet: GroupSet) {
    if (!groupSet) {
      return;
    }
    this.startLoading();
    this.selectGroup(null);
    this.canCreateGroups = !!this.unitRole || groupSet.allowStudentsToCreateGroups; // Convert unitRole to boolean
    this.unit.getGroups(groupSet).subscribe({
      next: () => {
        this.selectedGroupSet = groupSet;
        this.finishLoading();
        this.resetNewGroupForm();
        this.applyFilters();
      },
      error: (message: string) => {
        this.finishLoading();
        console.error(`Unable to get groups: ${message}`);
      },
    });
  }

  addGroup(name: string) {
    if (this.unit.tutorials.length === 0) {
      console.error('Please ensure there is at least one tutorial before groups are created');
      return;
    }

    let tutorialId;
    if (this.project) {
      tutorialId = this.project.tutorials[0]?.id || this.unit.tutorials[0]?.id;
    } else {
      const tutorName = this.unitRole || 'Default Tutor'; // Provide default value if unitRole is undefined
      tutorialId = this.unit.tutorials.find((tute) => tute.tutor?.name === tutorName)?.id;
      tutorialId ??= this.unit.tutorials[0]?.id;
    }

    this.groupService
      .create(
        {
          unitId: this.unit.id,
          groupSetId: this.selectedGroupSet.id,
        },
        {
          cache: this.selectedGroupSet.groupsCache,
          constructorParams: this.unit,
          body: {
            group: {
              name: name,
              tutorial_id: tutorialId,
            },
          },
        },
      )
      .subscribe({
        next: (group: Group) => {
          this.resetNewGroupForm();
          this.applyFilters();
          this.selectedGroup = group;
        },
        error: (message: string) => {
          console.error(message);
        },
      });
  }

  projectInGroup(group: Group) {
    return this.project?.inGroup(group);
  }

  joinGroup(group: Group) {
    if (!this.project) {
      return;
    }
    const partOfGroup = this.projectInGroup(group);
    if (partOfGroup) {
      console.error('You are already a member of this group');
      return;
    }
    group.addMember(this.project, () => {
      this.selectedGroup = group;
    });
  }

  updateGroup(data: GroupUpdateData, group: Group) {
    group.capacityAdjustment = data.capacityAdjustment;
    group.tutorial = data.tutorial;
    group.name = data.name;

    this.groupService.update(group).subscribe({
      next: () => {
        console.log('Updated group');
        this.applyFilters();
      },
      error: (message: string) => {
        console.error(`Failed to update group: ${message}`);
      },
    });
  }

  deleteGroup(group: Group) {
    this.groupService.delete(group, {cache: this.selectedGroupSet.groupsCache}).subscribe({
      next: () => {
        console.log('Deleted group');
        if (group.id === this.selectedGroup?.id) {
          this.selectedGroup = null;
        }
        this.resetNewGroupForm();
        this.applyFilters();
      },
      error: () => {
        console.error('Failed to delete group');
      },
    });
  }

  toggleLocked(group: Group) {
    group.locked = !group.locked;
    this.unit.updateGroup(group, (success: {locked: boolean}) => {
      // Specified the type of success object
      group.locked = success.locked;
      console.log('Group updated');
    });
  }

  selectGroupSetFromEvent(event: MouseEvent, args: {id: number}) {
    // Specified the type of args
    const newGroupSet = this.unit.findGroupSet(args.id);
    this.selectGroupSet(newGroupSet);
  }

  paginateAndSort(
    groups: Group[],
    pagination: {currentPage: number; pageSize: number},
    tableSort: {order: string; reverse: boolean},
  ): Group[] {
    const sortedGroups = [...groups];

    sortedGroups.sort((a, b) => {
      if (a[tableSort.order] < b[tableSort.order]) {
        return tableSort.reverse ? 1 : -1;
      }
      if (a[tableSort.order] > b[tableSort.order]) {
        return tableSort.reverse ? -1 : 1;
      }
      return 0;
    });

    // Paginate the sorted groups
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    return sortedGroups.slice(startIndex, endIndex);
  }
}
