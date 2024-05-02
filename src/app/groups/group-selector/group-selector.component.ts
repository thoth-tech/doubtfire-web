/* eslint-disable @angular-eslint/component-selector */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {Component, Input, OnInit, OnDestroy, Inject} from '@angular/core';
import {Subscription, throwError} from 'rxjs';
import {catchError, finalize} from 'rxjs/operators';
import {HttpClient} from '@angular/common/http';
import {alertService} from 'src/app/ajs-upgraded-providers';
import {Group, GroupSet} from 'src/app/api/models/doubtfire-model';
import {GroupService} from 'src/app/api/services/group.service';

@Component({
  selector: 'group-selector',
  templateUrl: './group-selector.component.html',
  styleUrls: ['./group-selector.component.scss'],
})
export class GroupSelectorComponent implements OnInit, OnDestroy {
  @Input() unit: any;
  @Input() project: any;
  @Input() unitRole: any;
  @Input() selectedGroupSet: any;
  selectedGroup: any;
  canCreateGroups: any;
  shownGroups: any;
  showGroupSetSelector: boolean = false;
  loaded: boolean = false;
  staffFilter: string;
  newGroupName: string = '';
  pagination: any = {
    currentPage: 1,
    maxSize: 10,
    pageSize: 10,
    totalSize: null,
    show: false,
    onChange: this.applyFilters.bind(this),
  };
  tableSort: any = {
    order: 'name',
    reverse: false,
  };
  filteredGroups: Group[] = [];
  listeners: Subscription[] = [];

  constructor(
    private http: HttpClient,
    @Inject(alertService) private alerts: any,
    private groupService: GroupService,
  ) {}

  ngOnInit(): void {
    this.listeners.push(this.listenTo());

    if ((!this.unitRole && !this.project) || (this.unitRole && this.project)) {
      throw new Error('Group selector must have exactly one unit role or one project');
    }

    // If unitRole is present, set the staff filter to 'all', otherwise set it to 'mine'
    this.setStaffFilter(this.unitRole ? 'all' : 'mine');

    // Select the group set based on the provided selectedGroupSet or the first group set of the unit
    if (this.selectedGroupSet) {
      this.selectGroupSet(this.selectedGroupSet);
    } else if (this.unit && this.unit.groupSets && this.unit.groupSets.length > 0) {
      this.selectGroupSet(this.unit.groupSets[0]);
    } else {
      console.error('No group sets available for selection.');
    }
  }

  listenTo(): Subscription {
    return new Subscription();
  }

  applyFilters(): void {
    let filteredGroups: Group[];
    if (this.unitRole) {
      filteredGroups = this.selectedGroupSet.groups.filter(
        // Corrected property name
        (group: Group) => group.tutorial.toString() === this.staffFilter,
      );
    } else {
      filteredGroups = this.selectedGroupSet.groups;
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

  selectGroupSet(groupSet: GroupSet | undefined): void {
    if (!groupSet) return;
    this.startLoading();
    this.selectedGroup = null;
    this.newGroupName = '';
    this.http
      .get<any[]>(`/api/groups?unitId=${this.unit.id}&groupSetId=${groupSet.id}`)
      .pipe(
        catchError((error) => {
          this.finishLoading();
          this.alerts.add('danger', `Unable to get groups ${error.message}`, 6000);
          return throwError(() => error);
        }),
        finalize(() => this.finishLoading()),
      )
      .subscribe(() => {
        this.selectedGroupSet = groupSet;
        this.applyFilters();
        this.finishLoading();
      });
  }

  startLoading(): void {
    this.loaded = false;
  }

  finishLoading(): void {
    setTimeout(() => {
      this.loaded = true;
      if (this.project) {
        this.selectedGroup = this.project.groupForGroupSet(this.selectedGroupSet);
      }
    }, 500);
  }

  selectGroup(group: Group): void {
    if (this.project && !this.project.inGroup(group)) return;
    this.selectedGroup = group;
  }

  resetNewGroupForm(): void {
    this.newGroupName = '';
  }

  addGroup(name: string): void {
    if (this.unit.tutorials.length === 0) {
      this.alerts.add(
        'danger',
        'Please ensure there is at least one tutorial before groups are created',
        6000,
      );
      return;
    }
    const tutorialId =
      this.project?.tutorials[0]?.id ||
      this.unit.tutorials.find((tute: any) => tute.tutor?.name === this.unitRole?.name)?.id ||
      this.unit.tutorials[0].id;
    this.http
      .post<any>(`/api/groups`, {
        unitId: this.unit.id,
        groupSetId: this.selectedGroupSet.id,
        name: name,
        tutorialId: tutorialId,
      })
      .subscribe({
        next: (group: Group) => {
          this.resetNewGroupForm();
          this.applyFilters();
          this.selectedGroup = group;
        },
        error: (error) => this.alerts.add('danger', error.message, 6000),
      });
  }

  projectInGroup(group: Group): boolean {
    return this.project?.inGroup(group);
  }

  joinGroup(group: Group): void {
    if (!this.project) return;
    const partOfGroup = this.projectInGroup(group);
    if (partOfGroup) {
      this.alerts.add('danger', 'You are already a member of this group');
      return;
    }
  }

  updateGroup(data: any, group: Group): void {
    group.capacityAdjustment = data.capacityAdjustment;
    group.tutorial = data.tutorial;
    group.name = data.name;

    this.groupService.update(group).subscribe({
      next: () => {
        this.alerts.add('success', 'Updated group', 2000);
        this.applyFilters();
      },
      error: (message: string) =>
        this.alerts.add('danger', `Failed to update group. ${message}`, 6000),
    });
  }

  deleteGroup(group: Group): void {
    this.groupService.delete(group, {cache: this.selectedGroupSet.groupsCache}).subscribe({
      next: () => {
        this.alerts.add('success', 'Deleted group', 2000);
        if (group.id === this.selectedGroup?.id) this.selectedGroup = null;
        this.resetNewGroupForm();
        this.applyFilters();
      },
      error: () => this.alerts.add('danger', 'Failed to delete group', 6000),
    });
  }

  toggleLocked(group: Group): void {
    group.locked = !group.locked;
    this.unit.updateGroup(group, (success: any) => {
      group.locked = success.locked;
      this.alerts.add('success', 'Group updated', 2000);
    });
  }

  ngOnDestroy(): void {
    this.listeners.forEach((sub) => sub.unsubscribe());
  }
}
