import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GroupMemberService {

  constructor() { }


  getGroupMembers(task: any, project: any): any[] {
    const group = project.getGroupForTask(task);
    return group ? group.getMembers() : [];
  }

}
