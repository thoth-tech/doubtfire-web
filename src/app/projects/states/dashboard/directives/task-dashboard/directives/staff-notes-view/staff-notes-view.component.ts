import {ChangeDetectionStrategy, Component, Input} from '@angular/core';

@Component({
  selector: 'f-staff-notes-view',
  templateUrl: './staff-notes-view.component.html',
  styleUrls: ['./staff-notes-view.component.scss'],
  // The notes list scrolls between the header and the composer, so the tab fills its host.
  host: {class: 'flex h-full min-h-0 flex-col'},
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class StaffNotesViewComponent {
  @Input() project;
}
