import { Component, OnInit } from '@angular/core';
import { GradeService } from 'src/app/common/services/grade.service'; // Adjust the path as necessary

@Component({
  selector: 'app-group-member-contribution-assigner',
  templateUrl: './group-member-contribution-assigner.component.html',
  styleUrls: ['./group-member-contribution-assigner.component.css']
})
export class GroupMemberContributionAssignerComponent implements OnInit {
  selectedGroupSet: any;
  selectedGroup: any;
  memberSortOrder: string = 'project.student.name';
  numStars: number = 5;
  initialStars: number = 3;
  percentages: any = {
    danger: 0,
    warning: 25,
    info: 50,
    success: 100
  };
  team: any = { memberContributions: [] };

  constructor(private gradeService: GradeService) {}

  ngOnInit(): void {
    this.selectedGroupSet = this.task.definition.groupSet;

    if (!this.task.isTestSubmission) {
      this.selectedGroup = this.project.getGroupForTask(this.task);
    }

    if (this.selectedGroup && this.selectedGroupSet) {
      this.selectedGroup.getMembers().subscribe((members: any[]) => {
        this.team.memberContributions = members.map(member => {
          const result = {
            project: member,
            rating: this.initialStars,
            confRating: this.initialStars,
            percent: 0
          };
          result.percent = this.memberPercentage(result, this.initialStars);
          return result;
        });
        this.updatePercentages(members.length);
      });
    } else {
      this.team.memberContributions = [];
    }
  }

  checkClearRating(contrib: any): void {
    if (contrib.confRating === 1 && contrib.overStar === 1 && contrib.rating === 0) {
      contrib.rating = contrib.percent = 0;
    } else if (contrib.confRating === 1 && contrib.overStar === 1 && contrib.rating === 0) {
      contrib.rating = 1;
    }
    contrib.confRating = contrib.rating;
  }

  memberPercentage(contrib: any, rating: number): string {
    return (100 * (rating / this.selectedGroup.contributionSum(this.team.memberContributions, contrib, rating))).toFixed();
  }

  hoveringOver(contrib: any, value: number): void {
    contrib.overStar = value;
    contrib.percent = this.memberPercentage(contrib, value);
  }

  percentClass(pct: number): string {
    if (pct >= this.percentages.success) {
      return 'label-success';
    } else if (pct >= this.percentages.info) {
      return 'label-info';
    } else if (pct >= this.percentages.warning) {
      return 'label-warning';
    } else {
      return 'label-danger';
    }
  }

  private updatePercentages(memberCount: number): void {
    this.percentages.warning = +(25 / memberCount).toFixed();
    this.percentages.info = +(50 / memberCount).toFixed();
    this.percentages.success = +(95 / memberCount).toFixed();
  }

  gradeFor(): any {
    return this.gradeService.gradeFor();
  }
}
