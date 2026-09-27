import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {Sort} from '@angular/material/sort';
import {MatTableDataSource} from '@angular/material/table';
import {Subscription} from 'rxjs';
import {GroupSet} from 'src/app/api/models/doubtfire-model';
import {Group, MemberContribution} from 'src/app/api/models/groups/group';
import {Project} from 'src/app/api/models/project';
import {Task} from 'src/app/api/models/task';

@Component({
  selector: 'f-group-member-contribution-assigner',
  templateUrl: './group-member-contribution-assigner.component.html',
  styleUrls: ['./group-member-contribution-assigner.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class GroupMemberContributionAssignerComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isTestSubmission: boolean;

  @Input() task: Task;
  @Input() project: Project;
  @Input() team = {memberContributions: [] as MemberContribution[]};
  @Output() teamChange: EventEmitter<{memberContributions: MemberContribution[]}> =
    new EventEmitter();

  selectedGroupSet: GroupSet;
  selectedGroup: Group;

  numStars = 5;
  initialStars = 3;
  readonly stars = Array.from({length: this.numStars}, (_, index) => index + 1);

  percentages = {
    danger: 0,
    warning: 25,
    info: 50,
    success: 100,
  };

  displayedColumns = ['name', 'target-grade', 'contribution'];
  dataSource: MatTableDataSource<MemberContribution> = new MatTableDataSource([]);

  private membersSub?: Subscription;

  ngOnInit(): void {
    this.initializeGroupData();
    this.loadMembers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // ngOnInit covers the first binding; loading here as well sent the request twice.
    const taskChanged = changes['task'] && !changes['task'].firstChange;
    const projectChanged = changes['project'] && !changes['project'].firstChange;
    if (taskChanged || projectChanged) {
      this.initializeGroupData();
      this.loadMembers();
    }
  }

  ngOnDestroy(): void {
    this.membersSub?.unsubscribe();
  }

  private initializeGroupData(): void {
    this.selectedGroupSet = this.task?.definition?.groupSet;
    // Start clean, so a test submission does not keep the group of an earlier task.
    this.selectedGroup = undefined;
    // Check if this is an overseer test submission
    if (!this.isTestSubmission) {
      const group = this.project?.getGroupForTask(this.task);
      this.selectedGroup = group;
      if (!this.selectedGroup && this.selectedGroupSet?.groups?.length > 0) {
        this.selectedGroup = this.selectedGroupSet.groups[0];
      }
    }
  }

  private loadMembers(): void {
    this.membersSub?.unsubscribe();

    if (this.selectedGroup && this.selectedGroupSet) {
      this.membersSub = this.selectedGroup.getMembers().subscribe({
        next: (members) => {
          this.team.memberContributions = members.map((member) => ({
            project: member,
            rating: this.initialStars,
            percent: 0,
            overStar: null,
          }));
          this.team.memberContributions.forEach((contribution) => {
            contribution.percent = this.percentFor(contribution);
          });

          // Update percentages based on member count
          this.percentages.warning = +(25 / members.length).toFixed();
          this.percentages.info = +(50 / members.length).toFixed();
          this.percentages.success = +(95 / members.length).toFixed();

          this.teamChange.emit(this.team);
          this.dataSource.data = [...this.team.memberContributions];
        },
      });
    } else {
      // No group to rate, which is expected for a test submission. This used to log
      // a console error on every one of them.
      this.team.memberContributions = [];
      this.teamChange.emit(this.team);
      this.dataSource.data = [];
    }
  }

  /**
   * A member's share of the team's effort, using the rating under the pointer while
   * the member is being rated. Worked out when shown, so every row follows a change
   * to any one rating, and a team rated all zero shows 0% instead of NaN.
   */
  percentFor(contrib: MemberContribution): number {
    const rating = contrib.overStar ?? contrib.rating;
    const total = this.team.memberContributions.reduce(
      (sum, current) => sum + (current === contrib ? rating : current.rating),
      0,
    );

    return total > 0 ? Math.round((100 * rating) / total) : 0;
  }

  selectRating(contrib: MemberContribution, rating: number) {
    if (contrib.rating !== rating) {
      contrib.rating = rating;
      this.hoveringOver(contrib, rating);
    } else {
      contrib.rating = 0;
      this.hoveringOver(contrib, 0);
    }
  }

  hoveringOver(contrib: MemberContribution, value: number | null): void {
    contrib.overStar = value;
    // Leaving the stars used to work the share out from no rating at all, so it
    // dropped to 0% until the next hover.
    contrib.percent = this.percentFor(contrib);
  }

  private sortCompare(aValue: number | string, bValue: number | string, isAsc: boolean) {
    return (aValue < bValue ? -1 : 1) * (isAsc ? 1 : -1);
  }

  sortTableData(sort: Sort) {
    if (!sort.active || sort.direction === '') {
      return;
    }
    this.dataSource.data = this.dataSource.data.sort((a, b) => {
      switch (sort.active) {
        case 'name':
          return this.sortCompare(
            a.project.student.name,
            b.project.student.name,
            sort.direction === 'asc',
          );
        case 'target-grade':
          return this.sortCompare(
            a.project.targetGrade,
            b.project.targetGrade,
            sort.direction === 'asc',
          );
        case 'contribution':
          return this.sortCompare(a.rating, b.rating, sort.direction === 'asc');
        default:
          return 0;
      }
    });
  }
}
