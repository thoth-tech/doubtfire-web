/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, Input } from '@angular/core';

@Component({
  selector: 'group-set-manager',
  templateUrl: './group-set-manager.component.html',
  styleUrls: ['./group-set-manager.component.scss'],
})
export class GroupSetManagerComponent {
  @Input() unit: any;
  @Input() unitRole: any;
  @Input() project: any;
  @Input() selectedGroup: any;
  @Input() selectedStudent: any;
  @Input() selectedGroupSet: any;
  @Input() showGroupSetSelector: boolean;

  constructor() {}

  newGroupSelected(event: any) {
    if (this.selectedGroupSet) {
      this.selectedGroup = this.selectedGroupSet.groups[0];
    }
    console.log('New group selected:', this.selectedGroup);
  }

  updateGroup(group: any) {
    if (group && group.name) {
      group.name = prompt("Edit group name", group.name) || group.name;
    }
    console.log('Group updated:', group);
  }

  addMember(student: any) {
    if (student && student.id) {
      this.selectedGroup.members.push(student);

      this.selectedStudent = { id: null, name: '' };

    }
    console.log('Member added:', student);
  }

  groupMembersLoaded() {
    if (this.selectedGroup && this.selectedGroup.members) {
      this.selectedGroup.members.forEach(member => {
        console.log('Loaded member:', member);
      });
    }
    console.log('Group members loaded');
  }
}
