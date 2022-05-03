
import { Component, Input, Inject, OnInit} from '@angular/core';
import { gradeService, projectService, groupService} from 'src/app/ajs-upgraded-providers';
// GroupMember
import * as _ from 'lodash';


// 
// Directive to rate each student's contributions
// in a group task assessment
// 

@Component({
 
  selector: 'group-member-contribution-assigner',
  templateUrl: './group-member-contribution-assigner.component.html',
  styleUrls: ['./group-member-contribution-assigner.component.scss'],
}) 

export class GroupMemberContributionAssignerComponent implements OnInit {

  @Input() task: any;  
  @Input() project: any;  
  @Input() team: any;  // out parameter
  selectedGroupSet: any;
  selectedGroup: any;
  memberSortOrder: string;
  numStars: number;
  initialStars: number;
  percentages: { danger: number; warning: number; info: number; success: number; };
  gradeFor: any;

  constructor(
    @Inject(gradeService) private gradeService: any, 
    @Inject(projectService) private projectService: any, 
    @Inject(groupService) private groupService: any, 
    //@Inject(GroupMember) private GroupMember: any,  
    ) {}

  ngOnInit(): void {
    this.selectedGroupSet = this.task.definition.group_set
    this.selectedGroup = this.projectService.getGroupForTask(this.project, this.task)

    this.memberSortOrder = 'student_name'
    this.numStars = 5
    this.initialStars = 3
    this.percentages = {
      danger: 0,
      warning: 25,
      info: 50,
      success: 100
    }
    this.gradeFor = this.gradeService.gradeFor

    // TODO: (@alexcu) Supply group members
    // if (this.selectedGroup && this.selectedGroupSet){
    //   GroupMember.query { unit_id: this.project.unit_id, group_set_id: this.selectedGroupSet.id, group_id: this.selectedGroup.id }, (members) ->
    //     this.team.members = _.map(members, (member) ->
    //       member.rating = member.confRating = this.initialStars
    //       member.percent = memberPercentage(member, member.rating)
    //       member
    //     )
    //    // Need the '+' to convert to number
    //     this.percentages.warning = +(25 / members.length).toFixed()
    //     this.percentages.info    = +(50 / members.length).toFixed()
    //     this.percentages.success = +(95 / members.length).toFixed()
    // else
    //   this.team.members = []
    // } 
  }

} 
function memberPercentage(member: any, rating: any): any {
  return (100 * (rating / this.groupService.groupContributionSum(this.team.members, member, rating))).toFixed()
}
function checkClearRating(member: { confRating: number; overStar: number; rating: number; percent: number; }) {
  if (member.confRating == 1 && member.overStar == 1 && member.rating == 0)
      member.rating = member.percent = 0
  else if (member.confRating == 1 && member.overStar == 1 && member.rating == 0)
      member.rating = 1
   member.confRating = member.rating
} 
function hoveringOver(member: { overStar: any; percent: any; }, value: any){
  member.overStar = value
  member.percent = memberPercentage(member, value)
}  

function percentClass (pct: number){
  if (pct >= this.percentages.success) return 'label-success'  
  if (this.percentages.info <= pct < this.percentages.success) return  'label-info'     
  if (this.percentages.warning <= pct < this.percentages.info) return 'label-warning'  
  if (this.percentages.danger  <= pct < this.percentages.warning) return 'label-danger'  
}
    
   

  

    
        

