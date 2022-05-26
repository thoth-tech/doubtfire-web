import { Component, Input, Inject, OnInit } from '@angular/core';
import { gradeService, projectService, groupService} from 'src/app/ajs-upgraded-providers';
import {GroupMemberService} from 'src/app/api/models/doubtfire-model';
import * as _ from 'lodash';
import { GroupMember } from 'src/app/api/models/group-member/group-member';

@Component({
  selector: 'group-member-contribution-assigner',
  templateUrl: './group-member-contribution-assigner.component.html',
  styleUrls: ['./group-member-contribution-assigner.component.scss'],
})

export class GroupMemberContributionAssignerComponent implements OnInit {

  @Input() task: any;
  @Input() project: any;
  @Input() team: any;  //out parameter  

  rating:number = 3;
  starCount:number = 5; 
  selectedGroupSet: any;
  selectedGroup: any;
  memberSortOrder: string;
  reverse: boolean;
  numStars: number;
  initialStars: number;
  percentages: { danger: number; warning: number; info: number; success: number; };
  gradeFor: any;
  members: any = []

  constructor(private groupMemberService: GroupMemberService,@Inject(projectService) private projectService: any,
    @Inject(groupService) private groupService: any,
    @Inject(gradeService) private gradeService: any) { }

  onRatingChanged(rating: number) { 
      
      this.rating = rating; 
  } 
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
    if (this.selectedGroup && this.selectedGroupSet) {    
       this.groupMemberService.query(
        {'unit_id': this.project.unit_id, group_set_id: this.selectedGroupSet.id, group_id: this.selectedGroup.id}).subscribe((members) => {
         
        this.members = members 
        this.team.members = _.map(members, (member: GroupMember) => {           
          member.confRating = this.initialStars
          member.rating = member.confRating 
          member.percent = this.memberPercentage(member, member.rating) 
          return member            
        }); 
        // Need the '+' to convert to number
        this.percentages.warning = +(25 / this.members.length).toFixed()
        this.percentages.info = +(50 / this.members.length).toFixed()
        this.percentages.success = +(95 / this.members.length).toFixed()
      }); 
      
    }
    else
      this.team.members = []
  }
  checkClearRating(member: GroupMember) {
    member.rating = this.rating

    if (member.confRating == 1 && member.overStar == 1 && member.rating == 0) {
      member.rating = 0 
      member.percent = "0"
    }
    member.confRating = member.rating
     return member;
  } 

  // get memebr percentage 
  memberPercentage(member: GroupMember, rating: number): string {
    return (100 * (rating / this.groupService.groupContributionSum(this.members, member, rating))).toFixed()
  }
  // when hover over 
  hoveringOver(member: GroupMember, value: number) {  
    member.overStar = value
    member.percent = this.memberPercentage(member, value)
  }
  
  // get label
  percentClass(pct: number) {
    if (pct >= this.percentages.success) return 'label-success'
    if (pct >= this.percentages.info) return 'label-info'
    if (pct >= this.percentages.warning) return 'label-warning'
    if (pct >= this.percentages.danger) return 'label-danger'
  }   
}
 
