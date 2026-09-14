import {Component, Input, booleanAttribute} from '@angular/core';

@Component({
  selector: 'f-page-container',
  templateUrl: './page-container.component.html',
  host: {class: 'block w-full'},
  standalone: false,
})
export class PageContainerComponent {
  @Input({transform: booleanAttribute}) fullWidth = false;
}
