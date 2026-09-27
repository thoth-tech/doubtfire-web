import {ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {UnitRole} from 'src/app/api/models/unit-role';

@Component({
  selector: 'f-tutor-notes-view',
  templateUrl: './tutor-notes-view.component.html',
  styleUrls: ['./tutor-notes-view.component.scss'],
  // The notes list scrolls between the header and the composer, so the tab fills its host.
  host: {class: 'flex h-full min-h-0 flex-col'},
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TutorNotesViewComponent implements OnChanges {
  @Input() task?;
  @Input() unitRole: UnitRole;
  /** The moderation notes dialog shows its own title, so the view leaves its heading out. */
  @Input() inDialog = false;

  private inferredUnitRole = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.unitRole?.currentValue) {
      this.inferredUnitRole = false;
    }

    if (this.task && (!this.unitRole || this.inferredUnitRole)) {
      this.unitRole = this.task.tutor;
      this.inferredUnitRole = true;
    }
  }

  public get description(): string {
    const name = this.unitRole?.user?.name ?? 'the tutor';
    const subject = this.task ? 'the feedback on this task' : `feedback from ${name}`;
    return `Staff-only discussion about ${subject}. Visible to ${name} and the convenors.`;
  }
}
