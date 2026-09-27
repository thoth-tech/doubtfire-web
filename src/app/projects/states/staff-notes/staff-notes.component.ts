import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {Subscription} from 'rxjs';
import {Project, UserService} from 'src/app/api/models/doubtfire-model';
import {StaffNote} from 'src/app/api/models/staff-note';
import {StaffNoteService} from 'src/app/api/services/staff-note.service';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';

@Component({
  selector: 'f-staff-notes',
  templateUrl: './staff-notes.component.html',
  styleUrl: './staff-notes.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class StaffNotesComponent implements OnInit, OnChanges {
  @ViewChild('staffNotesContainer') staffNotesContainer!: ElementRef;
  @ViewChild('staffNoteEditor', {static: false}) staffNoteEditor!: ElementRef<HTMLTextAreaElement>;

  @Input() project: Project;

  loadingStaffNotes: boolean = true;
  /** The last load failed, so the list offers a retry instead of saying there are none. */
  loadError = false;

  noteText: string = '';

  editingNote?: StaffNote;
  editingNoteText?: string = '';

  replyingToNote?: StaffNote;

  private notesSub?: Subscription;

  constructor(
    private userService: UserService,
    private staffNoteService: StaffNoteService,
    private alertService: AlertService,
    private confirmationModalService: ConfirmationModalService,
  ) {}
  ngOnInit(): void {
    this.loadNotes();
  }

  // The list reads the project's note cache, so a new project needs its notes loaded
  // or it would claim there are none. A reply, an edit or a draft belongs to the old
  // student, so none of them may carry over to the new one.
  ngOnChanges(changes: SimpleChanges): void {
    if (changes.project && !changes.project.firstChange && this.project) {
      this.replyingToNote = null;
      this.editingNote = null;
      this.editingNoteText = '';
      this.noteText = '';
      this.loadNotes();
    }
  }

  public get notes(): readonly StaffNote[] {
    return this.project?.staffNoteCache?.currentValues ?? [];
  }

  public loadNotes(): void {
    this.loadingStaffNotes = true;
    this.loadError = false;
    // Drop a load still running for an earlier project, or it could land late and
    // show that project's result over this one.
    this.notesSub?.unsubscribe();
    this.notesSub = this.staffNoteService.loadStaffNotes(this.project).subscribe({
      next: (_notes) => {
        this.loadingStaffNotes = false;
        this.staffNoteService.updateStaffNoteReplies(this.project?.staffNoteCache.currentValues);
        this.scrollDown();
      },
      error: () => {
        this.loadingStaffNotes = false;
        this.loadError = true;
      },
    });
  }

  scrollToComment(commentID: number) {
    document.querySelector(`#comment-${commentID}`).scrollIntoView();
  }

  scrollDown() {
    setTimeout(() => {
      const el = this.staffNotesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }, 50);
  }

  public submitNote() {
    const noteText = this.noteText.trim();
    if (noteText === '') {
      return;
    }

    this.noteText = '';

    this.staffNoteService.addNote(this.project, noteText, this.replyingToNote).subscribe({
      next: (_note) => {
        this.alertService.success('Successfully submitted note', 4000);
        this.scrollDown();
        this.project.staffNoteCount++;
        this.replyingToNote = null;
        this.staffNoteService.updateStaffNoteReplies(this.project?.staffNoteCache.currentValues);
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

    this.staffNoteService.updateNote(this.project, this.editingNote, noteText).subscribe({
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

  public deleteNote(note: StaffNote) {
    this.confirmationModalService.show(
      'Delete note',
      'Are you sure want to delete this staff note?',
      () => {
        note.delete();
      },
    );
  }

  public replyToNote(note: StaffNote) {
    this.replyingToNote = note;
  }
  public cancelReplyingToNote() {
    this.replyingToNote = null;
  }

  public editNote(note: StaffNote) {
    if (!note.authorIsMe) {
      return;
    }

    this.editingNote = note;
    this.editingNoteText = note.note;
    setTimeout(() => {
      this.autoResizeStaffNoteEditor();
      this.staffNoteEditor?.nativeElement.focus();
    });
  }

  public cancelEditingNote() {
    this.editingNote = null;
    this.editingNoteText = '';
  }

  public autoResizeStaffNoteEditor() {
    const el = this.staffNoteEditor.nativeElement;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  scrollToNote(note: StaffNote): void {
    const el = document.getElementById(`note-${note.id}`);
    if (el) {
      el.scrollIntoView({behavior: 'smooth', block: 'center'});
      el.classList.add('flash-highlight');
      setTimeout(() => el.classList.remove('flash-highlight'), 1000);
    }
  }
}
