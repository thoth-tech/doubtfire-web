

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { gradeService, projectService, groupService} from 'src/app/ajs-upgraded-providers';
import {GroupMemberService} from 'src/app/api/models/doubtfire-model';
import { GroupMember } from 'src/app/api/models/group-member/group-member';

import { GroupMemberContributionAssignerComponent } from './group-member-contribution-assigner.component';

describe('GroupMemberContributionAssignerComponent', () => {
  let component: GroupMemberContributionAssignerComponent;
  let fixture: ComponentFixture<GroupMemberContributionAssignerComponent>;
  let projectServiceStub: jasmine.SpyObj<any> = {};
  let groupServiceStub: jasmine.SpyObj<any> = {};
  let gradeServiceStub: jasmine.SpyObj<any> = {};
  let GroupMemberServiceStub: jasmine.SpyObj<any> = {};

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [GroupMemberContributionAssignerComponent],
        providers: [
          { provide: projectService, useValue: projectServiceStub },
          { provide: groupService, useValue: groupServiceStub },
          { provide: gradeService, useValue: gradeServiceStub },
          { provide: GroupMemberService, useValue: GroupMemberServiceStub },
        ],
      }).compileComponents();
    })
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(GroupMemberContributionAssignerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});