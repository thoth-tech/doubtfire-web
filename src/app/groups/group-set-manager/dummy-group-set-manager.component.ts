import { Component, Input } from '@angular/core';
import { Project } from 'src/app/api/models/project';
import { Unit } from 'src/app/api/models/unit';

@Component({
  selector: 'f-dummy-group-set-manager',
  template: '<p>Dummy group-set-manager works!</p>',
})
export class DummyGroupSetManagerComponent {
  @Input() project!: Project;
  @Input() unit!: Unit;
  @Input() selectedGroupSet: any;
}
