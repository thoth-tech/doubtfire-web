
import { User } from 'src/app/api/models/doubtfire-model';
import { Inject, Injectable } from '@angular/core';
import { CachedEntityService } from '../cached-entity.service';
import { GroupMember } from './group-member';
import { currentUser, auth, analyticsService } from 'src/app/ajs-upgraded-providers';
import { HttpClient } from '@angular/common/http';
 
@Injectable()
export class GroupMemberService extends CachedEntityService<GroupMember> {
  //protected readonly endpointFormat = 'units/:unit_id/group_sets/:group_set_id/groups/:group_id/members/:id';
  // hardcoding: could not make http call working 
  protected readonly endpointFormat = 'units/1/group_sets/1/groups/1/members';
  entityName = 'GroupMember'; 

  constructor(
    httpClient: HttpClient,
  ) {
    super(httpClient);
  }

  protected createInstanceFrom(json: any, other?: any): GroupMember {
    const groupMember = new GroupMember(json);
    groupMember.updateFromJson(json);
    return groupMember;
  }

  public keyForJson(json: any): string {
    return json.id;
  }
} 