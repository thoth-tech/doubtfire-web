import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import {MatChipSelectionChange} from '@angular/material/chips';
import {Task, UnitRole, UserService} from 'src/app/api/models/doubtfire-model';
import {TutorNote} from 'src/app/api/models/tutor-note';
import {TutorNoteService} from 'src/app/api/services/tutor-note.service';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';

@Component({
  selector: 'f-tutor-notes',
  templateUrl: './tutor-notes.component.html',
  styleUrl: './tutor-notes.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TutorNotesComponent implements OnInit {
  @ViewChild('tutorNotesContainer') tutorNotesContainer!: ElementRef;
  @ViewChild('tutorNoteEditor', {static: false}) tutorNoteEditor!: ElementRef<HTMLTextAreaElement>;

  @Input() unitRole: UnitRole;
  @Input() task: Task;

  loadingTutorNotes: boolean = true;
  /** The last load failed, so the list offers a retry instead of saying there are none. */
  loadError = false;

  noteText: string = '';

  editingNote?: TutorNote;
  editingNoteText?: string = '';

  replyingToNote?: TutorNote;

  constructor(
    private userService: UserService,
    private tutorNoteService: TutorNoteService,
    private alertService: AlertService,
    private confirmationModalService: ConfirmationModalService,
  ) {}
  ngOnInit(): void {
    if (this.task && !this.unitRole) {
      this.unitRole = this.task.tutor;
    }

    this.loadNotes();
    if (this.task) {
      this.selectedTaskDefinitions.set(this.task.definition.abbreviation, true);
    } else {
      this.selectedTaskDefinitions.set('all', true);
    }
  }

  public loadNotes(): void {
    this.loadingTutorNotes = true;
    this.loadError = false;
    this.tutorNoteService.loadTutorNotes(this.unitRole).subscribe({
      next: (_notes) => {
        this.loadingTutorNotes = false;
        this.tutorNoteService.updateTutorNoteReplies(this.unitRole?.tutorNotesCache.currentValues);
        this.scrollDown();
      },
      error: () => {
        this.loadingTutorNotes = false;
        this.loadError = true;
      },
    });
  }

  public get allNotes(): readonly TutorNote[] {
    return this.unitRole?.tutorNotesCache?.currentValues ?? [];
  }

  scrollToComment(commentID: number) {
    document.querySelector(`#comment-${commentID}`).scrollIntoView();
  }

  scrollDown() {
    setTimeout(() => {
      const el = this.tutorNotesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }, 50);
  }

  public submitNote() {
    const noteText = this.noteText.trim();
    if (noteText === '') {
      return;
    }

    this.noteText = '';

    this.tutorNoteService
      .addNote(this.unitRole, noteText, this.task, this.replyingToNote)
      .subscribe({
        next: (_note) => {
          this.alertService.success('Successfully submitted note', 4000);
          this.scrollDown();
          this.replyingToNote = null;
          this.tutorNoteService.updateTutorNoteReplies(
            this.unitRole?.tutorNotesCache.currentValues,
          );
        },
        error: (error) => {
          this.alertService.error(`Failed to create note: ${error}`, 4000);
          this.noteText = noteText;
        },
      });
  }

  public updateNote() {
    const noteText = this.editingNoteText.trim();
    if (noteText === '' || !this.editingNote) {
      return;
    }

    this.tutorNoteService.updateNote(this.unitRole, this.editingNote, noteText).subscribe({
      next: (_note) => {
        this.alertService.success('Successfully updated note', 4000);
        this.editingNote = null;
        this.editingNoteText = '';
      },
      error: (error) => {
        this.alertService.error(`Failed to update note: ${error}`, 4000);
      },
    });
  }

  public markAsRead(note: TutorNote) {
    this.tutorNoteService.markAsRead(this.unitRole, note).subscribe({
      next: (response) => {
        if (response) {
          this.alertService.success(`Marked note as read`, 3000);
        } else {
          this.alertService.error(`Failed to mark as read`, 6000);
        }
      },
      error: (error) => {
        this.alertService.error(`Failed to mark as read: ${error}`, 6000);
      },
    });
  }

  public deleteNote(note: TutorNote) {
    this.confirmationModalService.show(
      'Delete note',
      'Are you sure want to delete this tutor note?',
      () => {
        note.delete();
      },
    );
  }

  public replyToNote(note: TutorNote) {
    this.replyingToNote = note;
  }
  public cancelReplyingToNote() {
    this.replyingToNote = null;
  }

  public editNote(note: TutorNote) {
    if (!note.authorIsMe) {
      return;
    }

    this.editingNote = note;
    this.editingNoteText = note.note;
    setTimeout(() => {
      this.autoResizeTutorNoteEditor();
      this.tutorNoteEditor?.nativeElement.focus();
    });
  }

  public cancelEditingNote() {
    this.editingNote = null;
    this.editingNoteText = '';
  }

  public autoResizeTutorNoteEditor() {
    const el = this.tutorNoteEditor.nativeElement;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  scrollToNote(note: TutorNote): void {
    const el = document.getElementById(`note-${note.id}`);
    if (el) {
      el.scrollIntoView({behavior: 'smooth', block: 'center'});
      el.classList.add('flash-highlight');
      setTimeout(() => el.classList.remove('flash-highlight'), 1000);
    }
  }

  public selectedTaskDefinitions: Map<string, boolean> = new Map<string, boolean>();

  public get filteredNotes() {
    const selected = this.selectedTaskDefinitions;
    const allSelected = selected.size === 0 || selected.get('all');

    return (
      this.unitRole?.tutorNotesCache?.currentValues?.filter((note) => {
        const abbr = note.taskDefinition?.abbreviation;
        // if (!abbr) return false; // skip notes without taskDefinition
        if (allSelected) {
          return true;
        }
        return selected.get(abbr);
      }) ?? []
    );
  }

  // Follows the chip's own selection event rather than a click, so a keyboard toggle
  // filters the list too. Programmatic changes from the [selected] binding are ignored.
  onFilterChange(option: string, change: MatChipSelectionChange) {
    if (!change.isUserInput) {
      return;
    }
    this.selectedTaskDefinitions.set(option, change.selected);
  }

  public get taskDefinitionFilters() {
    const abbrs =
      this.unitRole.tutorNotesCache.currentValues
        .map((note) => note.taskDefinition?.abbreviation)
        .filter(Boolean) ?? [];

    // Remove duplicates
    return Array.from(new Set(abbrs));
  }

  /** The student's task, opened as staff. A real link, so it works from the keyboard. */
  projectLink(note: TutorNote): string {
    const abbreviation = note.taskDefinition?.abbreviation ?? '';
    return `/projects/${note.project.id}/dashboard/${abbreviation}?tutor=true`;
  }
}
