import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input, OnChanges} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {TeamsMeetingDraft, teamsMeetingContent, teamsMeetingDraftUrl} from './teams-meeting-draft';

@Component({
  selector: 'f-teams-meeting-composer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatIconModule],
  templateUrl: './teams-meeting-composer.component.html',
  styleUrl: './teams-meeting-composer.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class TeamsMeetingComposerComponent implements OnChanges {
  @Input() draft: TeamsMeetingDraft | null = null;
  @Input() unitCode = '';
  @Input() unavailableReason = '';

  readonly attendees = new FormControl('', {nonNullable: true});
  readonly content = new FormControl('', {nonNullable: true});
  private previousUnit = '';
  private initialContent: string | null = null;

  ngOnChanges(): void {
    if (this.previousUnit !== this.unitCode || !this.draft) {
      this.attendees.setValue('');
      this.previousUnit = this.unitCode;
    }
    if (!this.draft) {
      this.initialContent = null;
      this.content.setValue('');
      return;
    }
    try {
      const initial = teamsMeetingContent(this.draft, this.unitCode);
      // A parent getter can return a fresh snapshot on every change detection pass.
      if (initial !== this.initialContent) {
        this.initialContent = initial;
        this.content.setValue(initial);
      }
    } catch {
      this.initialContent = null;
      this.content.setValue('');
    }
  }

  get launch(): {url: string | null; error: string} {
    if (!this.draft) {
      return {
        url: null,
        error: this.unavailableReason || 'Enter the session title, dates and time zone first.',
      };
    }
    try {
      return {
        url: teamsMeetingDraftUrl(this.draft, this.unitCode, {
          attendees: this.attendees.value,
          content: this.content.value,
        }),
        error: '',
      };
    } catch (error) {
      return {
        url: null,
        error: error instanceof Error ? error.message : 'Check the meeting details.',
      };
    }
  }

  get schedule(): string {
    if (!this.draft) {
      return '';
    }
    try {
      const format = new Intl.DateTimeFormat(undefined, {
        timeZone: this.draft.timezone,
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      return `${format.format(new Date(this.draft.start_at))} – ${format.format(new Date(this.draft.end_at))} (${this.draft.timezone})`;
    } catch {
      return '';
    }
  }
}
