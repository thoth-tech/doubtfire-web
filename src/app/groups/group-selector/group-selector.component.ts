/* eslint-disable @angular-eslint/component-selector */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {Component, Inject, Input, OnInit} from '@angular/core';
import {Group, GroupSet} from 'src/app/api/models/doubtfire-model';
import {alertService} from 'src/app/ajs-upgraded-providers';
import {UserService} from 'src/app/api/services/user.service';
import {GroupService} from 'src/app/api/services/group.service';
import {Unit} from 'src/app/api/models/unit';
import {UnitRole} from 'src/app/api/models/unit-role';
import {Project} from 'src/app/api/models/project';
import {UnitService} from 'src/app/api/services/unit.service';
import * as _ from 'lodash';

@Component({
  selector: 'group-selector',
  templateUrl: './group-selector.component.html',
  styleUrls: ['./group-selector.component.scss'],
})
export class GroupSelectorComponent implements OnInit {
  @Input() unit: Unit;
  @Input() project: Project;
  @Input() UnitRole: boolean;
  @Input() selectedGroupSet: any;
  @Input() selectedGroup: Group;
  @Input() showGroupSetSelector: boolean;
  @Input() onSelect: (group: Group) => void;

  shownGroups: any;
  loaded: boolean;

  staffFilter: string = '';
  filteredGroups: Group[] = [];
  canCreateGroups: boolean;
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

  constructor(
    @Inject(alertService) private AlertService: any,
    @Inject(UserService) private userService: any,
    @Inject(GroupService) private groupService: any,
    @Inject(UnitService) private unitService: any,
  ) {}

  ngOnInit(): void {
    console.log('Unit Role:', this.UnitRole);
    console.log('Project:', this.project);
    if ((this.UnitRole && this.project) || (!this.UnitRole && !this.project)) {
      console.log('Throwing error: Group selector must have exactly one unit role or one project');
      throw new Error('Group selector must have exactly one unit role or one project');
    } else if (this.UnitRole) {
      this.setStaffFilter('all');
    } else if (this.project) {
      this.setStaffFilter('mine');
    }

    this.selectGroupSet(this.selectedGroupSet);
  }

  applyFilters(): void {
    console.log('applyFilters');
    console.log('selectedGroupSet.groups:', this.selectedGroupSet.groups);

    if (!this.selectedGroupSet || !this.selectedGroupSet.groups) {
      console.warn('selectedGroupSet or selectedGroupSet.groups is undefined.');
      return;
    }

    let filteredGroups: Group[] = [];

    if (this.UnitRole) {
      filteredGroups = this.selectedGroupSet.groups.filter((group: Group) =>
        this.userService.groupsInTutorials(group, this.UnitRole, this.staffFilter),
      );
    } else {
      filteredGroups = [...this.selectedGroupSet.groups];
    }

    this.filteredGroups = filteredGroups.filter((group) => group instanceof Group);
  }

  setStaffFilter(scope: string): void {
    console.log('setStaffFilter');
    console.log('scope:', scope);

    this.staffFilter = scope;
    this.applyFilters();
  }

  sortTableBy(column: string): void {
    this.tableSort.order = column;
    this.tableSort.reverse = !this.tableSort.reverse;
    this.applyFilters();
  }

  selectGroup(group: Group): void {
    if (this.project && !this.project.inGroup(group)) {
      return;
    }
    this.selectedGroup = group;
    if (this.onSelect) {
      this.onSelect(group);
    }
  }

  resetNewGroupForm(): void {
    this.selectedGroup = null;
  }

  selectGroupSet(groupSet: GroupSet): void {
    if (!groupSet) {
      return;
    }
    this.startLoading();
    this.selectedGroup = null;
    this.canCreateGroups = this.UnitRole || groupSet.allowStudentsToCreateGroups;

    this.unit.getGroups(groupSet).subscribe({
      next: () => {
        this.selectedGroupSet = groupSet;
        this.finishLoading();
        this.resetNewGroupForm();
        this.applyFilters();
      },
      error: (message: any) => {
        this.finishLoading();
        this.AlertService.add('danger', `Unable to get groups ${message}`, 6000);
      },
    });
  }

  startLoading(): void {
    this.pagination.currentPage = 1;
    this.pagination.totalSize = null;
    this.pagination.show = false;
  }

  finishLoading(): void {
    setTimeout(() => {
      this.pagination.show = true;
      this.pagination.totalSize = this.selectedGroupSet.groups.length;
      this.applyFilters();
      if (this.project) {
        this.selectGroup(this.project.groupForGroupSet(this.selectedGroupSet));
      }
    }, 500);
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
      const tutorName = this.userService.name || this.userService.currentUser.name;
      const tutorTutorial = _.find(
        this.unit.tutorials,
        (tute: any) => tute.tutor?.name === tutorName,
      );
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
    if (!this.project) {
      return;
    }
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