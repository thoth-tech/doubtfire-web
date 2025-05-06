import { Component, Input, Output, EventEmitter, OnInit, Inject, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { GradeService } from 'src/app/common/services/grade.service';
import { AlertService } from 'src/app/common/services/alert.service';
import { Project } from 'src/app/api/models/project';
import { UnitRole } from 'src/app/api/models/unit-role';
import { Group } from 'src/app/api/models/doubtfire-model';

@Component({
  selector: 'f-group-member-list',
  templateUrl: 'group-member-list.component.html',
  styleUrls: ['./group-member-list-component.scss'],
})
export class GroupMemberListComponent implements OnInit, OnChanges {
  @Input() project: Project;
  @Input() unitRole: UnitRole;
  @Input() selectedGroup: Group;
  @Output() onMembersLoaded = new EventEmitter<void>();
  loaded: boolean = true;
  public canRemoveMembers: boolean;
  private cdr: ChangeDetectorRef
  members:any[]=[]
  tableSort = {
    order: 'student?.name',
    reverse: false,
  };

  constructor(
    private gradeService: GradeService,
    private alertService: AlertService,
  ) {}

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.selectedGroup && changes.selectedGroup.currentValue) {
      this.startLoading();

      this.canRemoveMembers =
        (this.selectedGroup?.groupSet?.allowStudentsToManageGroups && !this.selectedGroup?.locked);

      if (this.selectedGroup?.getMembers) {
        this.selectedGroup.getMembers().subscribe({
          next: (members) => {
            this.members=members

            this.finishLoading();
          },
          error: (error) => {
            setTimeout(() => {
              this.alertService.error('Unauthorized to view members in this group', 3000);
              this.selectedGroup = null;
            }, 1000);
          }
        });
      }
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
  }

  finishLoading(): void {
    setTimeout(() => {
      this.loaded = true;
      this.onMembersLoaded.emit();
    }, 500);
  }

  removeMember(member: Project): void {
    if (this.selectedGroup) {
      this.selectedGroup.removeMember(member);
    setTimeout(() => {
      this.cdr.detectChanges(); // This triggers the view to refresh
    }, 0);
  }
  }

}