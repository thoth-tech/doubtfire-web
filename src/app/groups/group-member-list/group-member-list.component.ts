import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { alertService } from 'src/app/ajs-upgraded-providers';
import { gradeService } from 'src/app/ajs-upgraded-providers';
import { listenerService } from 'src/app/ajs-upgraded-providers';


export class GroupMemberListComponent implements OnInit, OnDestroy {
  @Input() unit: any;
  @Input() project: any;
  @Input() unitRole: any;
  @Input() selectedGroup: any;
  @Input() onMembersLoaded: () => void;

  public loaded: boolean = false;
  public tableSort = { order: 'student_name', reverse: false };
  public canRemoveMembers: boolean;
  private subscriptions = new Subscription();

  constructor(
    private alertService: AlertService,
    private gradeService: GradeService,
    private listenerService: ListenerService
  ) {}

  ngOnInit(): void {
    this.listenerService.listenTo(this).subscribe({
      next: (id) => this.loadMembers(id),
      error: (err) => console.error('Error listening', err)
    });
    this.loadMembers(this.selectedGroup.id);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  sortTableBy(column: string): void {
    this.tableSort.order = column;
    this.tableSort.reverse = !this.tableSort.reverse;
  }

  removeMember(member: any): void {
    this.selectedGroup.removeMember(member);
  }

  private loadMembers(groupId: string): void {
    if (!groupId) {
      return;
    }
    this.startLoading();
    this.canRemoveMembers = this.unitRole || (this.selectedGroup.groupSet.allowStudentsToManageGroups && !this.selectedGroup.locked);

    this.selectedGroup.getMembers().subscribe({
      next: (members) => this.finishLoading(),
      error: (failure) => setTimeout(() => {
        this.alertService.add("danger", "Unauthorized to view members in this group", 3000);
        this.selectedGroup = null;
      }, 1000)
    });
  }

  private startLoading(): void {
    this.loaded = false;
  }

  private finishLoading(): void {
    setTimeout(() => {
      this.loaded = true;
      if (this.onMembersLoaded) {
        this.onMembersLoaded();
      }
    }, 500);
  }
}
