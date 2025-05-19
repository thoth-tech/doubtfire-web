import {Component, Input, Output, EventEmitter, OnInit} from '@angular/core';


 import {GroupSet} from 'src/app/api/models/groups/group-set';
 import {Unit} from 'src/app/api/models/unit';

 @Component({
   selector: 'group-set-selector',
   templateUrl: './group-set-selector.component.html',
   styleUrls: ['./group-set-selector.component.scss'],
 })
 export class GroupSetSelectorComponent implements OnInit {
   @Input() unit: Unit;
   @Input() selectedGroupSet: GroupSet;
   @Output() onSelectGroupSet = new EventEmitter<GroupSet>();

   ngOnInit() {
     if (!this.unit) {
       throw new Error('Unit not supplied to group set selector');
     }
   }

   selectGroupSet() {
     console.log('Group set selector initialized');
     this.onSelectGroupSet.emit(this.selectedGroupSet);
   }
 }