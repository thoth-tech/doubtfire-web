import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { GradeService } from 'src/app/common/services/grade.service';
import { AlertService } from 'src/app/common/services/alert.service';
import { Project } from 'src/app/api/models/project';
import { UnitRole } from 'src/app/api/models/unit-role';
import { Group } from 'src/app/api/models/doubtfire-model';

@Component({
  selector: 'f-group-member-list',
  templateUrl: './group-member-list.component.html',
  styleUrls: ['./group-member-list.component.scss'],
})
export class GroupMemberListComponent implements OnInit, OnChanges {
  @Input() project: Project;
  @Input() unitRole: UnitRole;
  @Input() selectedGroup: Group;
  @Output() onMembersLoaded = new EventEmitter<any[]>();

  members: any[] = [];
  loaded: boolean = false;
  canRemoveMembers: boolean = false;
  tableSort = {
    order: 'student?.name',
    reverse: false,
  };

  constructor(
    private gradeService: GradeService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Load members if the selectedGroup is already set on init
    if (this.selectedGroup) {
      console.log("Selected group already set on init, loading members...");
      this.loadMembers();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.selectedGroup && changes.selectedGroup.currentValue) {
      console.log("Selected group changed, loading members...");
      this.loadMembers();
    }
  }

  private loadMembers(): void {
    if (!this.selectedGroup) {
      console.warn("No selected group, skipping member load.");
      return;
    }

    this.startLoading();

    this.canRemoveMembers = !!(
      this.selectedGroup.groupSet?.allowStudentsToManageGroups &&
      !this.selectedGroup.locked
    );

    if (typeof this.selectedGroup.getMembers === 'function') {
      console.log("Loading members for group:", this.selectedGroup.name);
      this.selectedGroup.getMembers().subscribe({
        next: (members: any[]) => {
          this.members = members;
          this.finishLoading();
          console.log("Members loaded:", this.members);
        },
        error: (error) => {
          this.handleError(error);
        }
      });
    } else {
      console.error("selectedGroup.getMembers is not a function");
      this.handleError();
    }
  }

  sortTableBy(column: string): void {
    if (this.tableSort.order === column) {
      this.tableSort.reverse = !this.tableSort.reverse;
    } else {
      this.tableSort.order = column;
      this.tableSort.reverse = false;
    }

    this.members.sort((a, b) => {
      const aValue = this.getNestedValue(a, this.tableSort.order);
      const bValue = this.getNestedValue(b, this.tableSort.order);

      if (aValue < bValue) return this.tableSort.reverse ? 1 : -1;
      if (aValue > bValue) return this.tableSort.reverse ? -1 : 1;
      return 0;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : ''), obj);
  }

  startLoading(): void {
    this.loaded = false;
    this.cdr.detectChanges();
  }

  finishLoading(): void {
    this.loaded = true;
    this.onMembersLoaded.emit(this.members);
    this.cdr.detectChanges(); // Force view refresh
  }

  removeMember(member: any): void {
    if (!this.selectedGroup) {
      console.warn("No selected group, cannot remove member.");
      return;
    }

    console.log("Removing member:", member);
    this.selectedGroup.removeMember(member);
    this.members = this.members.filter(m => m !== member);
    this.cdr.detectChanges(); // Force view refresh
  }

  private handleError(error?: any): void {
    console.error("Error loading members:", error);
    this.alertService.error('Unauthorized to view members in this group', 3000);
    this.selectedGroup = null;
    this.members = [];
    this.finishLoading();
  }
}
