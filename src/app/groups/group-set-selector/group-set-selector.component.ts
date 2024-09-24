import {Component, Input, Output, EventEmitter, OnInit} from '@angular/core';
import {Unit, GroupSet} from '/workspace/doubtfire-web/src/app/api/models/doubtfire-model';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'group-set-selector',
  templateUrl: './group-set-selector.component.html',
})
export class GroupSetSelectorComponent implements OnInit {
  @Input() unit: Unit;
  @Input() selectedGroupSet: GroupSet;
  @Output() selectGroupSet = new EventEmitter<GroupSet>(); // Renamed to follow Angular conventions

  ngOnInit() {
    if (!this.unit) {
      throw new Error('Unit not supplied to group set selector');
    }
  }

  onGroupSetSelect() {
    // Method name changed to be more descriptive and avoid confusion with the @Output name
    this.selectGroupSet.emit(this.selectedGroupSet);
  }
}
