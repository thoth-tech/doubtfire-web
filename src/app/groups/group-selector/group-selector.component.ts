import { Component, Input } from '@angular/core';
@Component({
  selector: 'group-selector',
  templateUrl: './group-selector.component.html',
  styleUrls: ['./group-selector.component.css']
})
export class GroupSelectorComponent {
  @Input() showGroupSetSelector: boolean;
  @Input() unit: any;
  @Input() selectedGroupSet: any;
  @Input() onChange: Function;
  @Input() canCreateGroups: boolean;
  @Input() unitRole: boolean;
  @Input() project: any;
  @Input() loaded: boolean;
  @Input() staffFilter: string;
  @Input() newGroupName: string;
  @Input() filteredGroups: any[];
  @Input() shownGroups: any[];
  @Input() tableSort: any;
  @Input() pagination: any;
}
