/* eslint-disable @angular-eslint/component-selector */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {Component, Inject, Input, OnInit} from '@angular/core';
import {Group, GroupSet,} from 'src/app/api/models/doubtfire-model';
import {alertService} from 'src/app/ajs-upgraded-providers';
import {UserService} from 'src/app/api/services/user.service';
import {GroupService} from 'src/app/api/services/group.service';
import {Unit} from 'src/app/api/models/unit';
import {UnitService} from 'src/app/api/services/unit.service';

@Component({
  selector: 'group-selector',
  templateUrl: './group-selector.component.html',
  styleUrls: ['./group-selector.component.scss'],
})
export class GroupSelectorComponent implements OnInit {
  @Input() unit: Unit;
  @Input() project: any;
  @Input() unitRole: any;
  @Input() selectedGroupSet: GroupSet;
  @Input() selectedGroup: Group;
  @Input() showGroupSetSelector: boolean;
  @Input() onSelect: (group: Group) => void;
  shownGroups: any;
  canCreateGroups: any;

  filteredGroups: Group[] = [];
  pagination: any = {
    currentPage: 1,
    maxSize: 10,
    pageSize: 10,
    totalSize: null,
    show: false,
    onChange: () => this.applyFilters(),
  };
  tableSort: any = {
    order: 'name',
    reverse: false,
  };
  staffFilter: string = '';
  loaded: boolean;
  selectGroup: any;
  newGroupName: string;

  constructor(
    @Inject(alertService) private AlertService: any,
    @Inject(UserService) private userService: any,
    @Inject(GroupService) private groupService: any,
    @Inject(UnitService) private unitService: any,
  ) {}

  ngOnInit(): void {
    if ((!this.unitRole && !this.project) || (this.unitRole && this.project)) {
      /*throw new Error('Group selector must have exactly one unit role or one project');*/
    }

    this.setStaffFilter(this.unitRole ? 'all' : 'mine');
    this.selectGroupSet(this.selectedGroupSet);
  }

  applyFilters(): void {
    let filteredGroups: Group[] = [];

    // Check if selectedGroupSet.groups is iterable
    if (
      this.selectedGroupSet &&
      this.selectedGroupSet.groups &&
      Symbol.iterator in Object(this.selectedGroupSet.groups)
    ) {
      if (this.unitRole) {
        filteredGroups = this.selectedGroupSet.groups.filter(
          (group: Group) => group.tutorial.toString() === this.staffFilter,
        );
      }
    }

    this.filteredGroups = this.paginateAndSort(filteredGroups);
  }

  paginateAndSort(groups: Group[]): Group[] {
    groups.sort((a, b) => {
      if (this.tableSort.order === 'name') {
        return this.tableSort.reverse ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      } else if (this.tableSort.order === 'tutorial.abbreviation') {
        return this.tableSort.reverse
          ? b.tutorial.abbreviation.localeCompare(a.tutorial.abbreviation)
          : a.tutorial.abbreviation.localeCompare(b.tutorial.abbreviation);
      } else if (this.tableSort.order === 'capacityAdjustment') {
        return this.tableSort.reverse
          ? b.capacityAdjustment - a.capacityAdjustment
          : a.capacityAdjustment - b.capacityAdjustment;
      } else if (this.tableSort.order === 'hasSpace()') {
        return this.tableSort.reverse ? (b.hasSpace() ? -1 : 1) : a.hasSpace() ? -1 : 1;
      }
      return 0;
    });
    const startIndex = (this.pagination.currentPage - 1) * this.pagination.pageSize;
    const endIndex = startIndex + this.pagination.pageSize;
    return groups.slice(startIndex, endIndex);
  }

  setStaffFilter(scope: string): void {
    this.staffFilter = scope;
    this.applyFilters();
  }

  selectGroupSet(groupSet: GroupSet): void {
    if (!groupSet) return;
    this.startLoading();

    this.unit.getGroups(groupSet).subscribe({
      next: () => {
        this.selectedGroupSet = groupSet;
        this.finishLoading();
        this.resetNewGroupForm();
        this.applyFilters();
      },
      error: (error: any) => {
        console.error('Error fetching groups:', error);
        this.finishLoading();
        const errorMessage = error && error.message ? error.message : 'Unknown error';
        this.AlertService.add('danger', `Unable to get groups: ${errorMessage}`, 6000);
      },
    });
  }

  startLoading(): void {
    this.loaded = false;
  }

  finishLoading(): void {
    setTimeout(() => {
      this.loaded = true;
      if (this.project) {
        this.selectGroup(this.project.groupForGroupSet(this.selectedGroupSet));
      }
    }, 500);
  }

  resetNewGroupForm(): void {
    this.newGroupName = '';
  }

  addGroup(name: string): void {
    if (this.unit.tutorials.length === 0) {
      this.AlertService.add(
        'danger',
        'Please ensure there is at least one tutorial before groups are created',
        6000,
      );
      return;
    }

    let tutorialId: number | null = null;

    if (this.project) {
      tutorialId = this.project.tutorials[0]?.id || this.unit.tutorials[0]?.id;
    } else {
      const tutorName = this.unitRole?.name || this.userService.currentUser.name;
      const tutorTutorial = this.unit.tutorials.find((tute: any) => tute.tutor?.name === tutorName);
      tutorialId = tutorTutorial?.id || this.unit.tutorials[0]?.id;
    }

    if (!tutorialId) {
      console.error('Failed to get tutorial ID for adding group.');
      return;
    }

    const groupData = {
      unitId: this.unit.id,
      groupSetId: this.selectedGroupSet.id,
      body: {
        group: {
          name: name,
          tutorial_id: tutorialId,
        },
      },
    };

    this.groupService.create(groupData).subscribe({
      next: (group: Group) => {
        this.resetNewGroupForm();
        this.applyFilters();
        this.selectedGroup = group;
      },
      error: (message: string) => {
        console.error('Error creating group:', message);
        this.AlertService.add('danger', message, 6000);
      },
    });
  }

  projectInGroup(group: Group): boolean {
    return this.project?.inGroup(group);
  }

  joinGroup(group: Group): void {
    if (!this.project) return;
    const partOfGroup = this.projectInGroup(group);
    if (partOfGroup) {
      this.AlertService.add('danger', 'You are already member of this group');
      return;
    }
    group.addMember(this.project, () => {
      this.selectedGroup = group;
    });
  }

  updateGroup(data: any, group: Group): void {
    group.capacityAdjustment = data.capacityAdjustment;
    group.tutorial = data.tutorial;
    group.name = data.name;

    this.groupService.update(group).subscribe({
      next: () => {
        this.AlertService.add('success', 'Updated group', 2000);
        this.applyFilters();
      },
      error: (message: string) => {
        this.AlertService.add('danger', `Failed to update group. ${message}`, 6000);
      },
    });
  }

  deleteGroup(group: Group): void {
    this.groupService.delete(group, {cache: this.selectedGroupSet.groupsCache}).subscribe({
      next: () => {
        this.AlertService.add('success', 'Deleted group', 2000);
        if (group.id === this.selectedGroup?.id) {
          this.selectedGroup = null;
        }
        this.resetNewGroupForm();
        this.applyFilters();
      },
      error: () => {
        this.AlertService.add('danger', `Failed to delete group. ${onmessage}`, 6000);
      },
    });
  }

  toggleLocked(group: Group): void {
    group.locked = !group.locked;
    this.updateGroup(group, group),
      {
        next: (success: any) => {
          group.locked = success.locked;
          this.AlertService.add('success', 'Group updated', 2000);
        },
        error: (error: any) => {
          console.error('Error updating group:', error);
          this.AlertService.add('danger', 'Failed to update group', 2000);
        },
      };
  }
}
