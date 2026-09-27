import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import {UntypedFormControl, Validators} from '@angular/forms';
import {MatTableDataSource} from '@angular/material/table';
import {Subscription} from 'rxjs';
import {DiscussionPrompt} from 'src/app/api/models/discussion-prompt';
import {Task} from 'src/app/api/models/task';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {Unit} from 'src/app/api/models/unit';
import {DiscussionPromptService} from 'src/app/api/services/discussion-prompt.service';
import {EntityFormComponent} from 'src/app/common/entity-form/entity-form.component';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';

@Component({
  selector: 'f-task-definition-discussion-prompts',
  templateUrl: 'task-definition-discussion-prompts.component.html',
  styleUrls: ['task-definition-discussion-prompts.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskDefinitionDiscussionPromptsComponent
  extends EntityFormComponent<DiscussionPrompt>
  implements OnInit, OnChanges, OnDestroy
{
  @Input() taskDefinition: TaskDefinition;
  @Input() staffView: boolean;
  @Input() task: Task;

  displayedColumns: string[] = ['content', 'priority', 'actions'];

  public readonly priorityOptions = [
    {value: 3, label: 'High'},
    {value: 2, label: 'Medium'},
    {value: 1, label: 'Low'},
  ];

  private promptsSub?: Subscription;

  public dataSource: MatTableDataSource<DiscussionPrompt> = new MatTableDataSource();

  creatingNewDiscussionPrompt: boolean = false;

  newDiscussionPromptContent: string;
  newDiscussionPromptWeight: number = 2;

  constructor(
    private alertService: AlertService,
    private discussionPromptService: DiscussionPromptService,
    private confirmationModal: ConfirmationModalService,
  ) {
    super(
      {
        content: new UntypedFormControl('', [Validators.required]),
        priority: new UntypedFormControl('', [Validators.required]),
      },
      'Discussion Prompt',
    );
  }
  public get unit(): Unit {
    return this.taskDefinition?.unit;
  }

  public get contentControl(): UntypedFormControl {
    return this.formData.get('content') as UntypedFormControl;
  }

  public get priorityControl(): UntypedFormControl {
    return this.formData.get('priority') as UntypedFormControl;
  }

  public get canAddPrompt(): boolean {
    return !!this.newDiscussionPromptContent?.trim();
  }

  public get canSaveEdit(): boolean {
    return !!`${this.formData.value.content ?? ''}`.trim() && !!this.formData.value.priority;
  }

  ngOnInit(): void {
    // ngOnChanges has already subscribed when the task came in as an input.
    if (!this.promptsSub && this.taskDefinition) {
      this.watchPrompts();
    }
  }

  ngOnDestroy(): void {
    this.promptsSub?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes.taskDefinition &&
      changes.taskDefinition.previousValue?.id !== changes.taskDefinition.currentValue?.id
    ) {
      this.cancelEdit();
      this.cancelNewDiscussionPrompt();
      this.watchPrompts();
      this.fetchDiscussionPrompts();
    }
  }

  private watchPrompts() {
    this.promptsSub?.unsubscribe();
    this.promptsSub = this.taskDefinition.discussionPromptsCache.values.subscribe((values) => {
      this.dataSource.data = values;
    });
  }

  private fetchDiscussionPrompts() {
    const taskDefinition = this.taskDefinition;
    if (!taskDefinition.id) {
      return;
    }
    this.discussionPromptService.loadDiscussionPrompts(null, taskDefinition).subscribe({
      next: (data) => {
        this.dataSource.data = data;
      },
      error: (error) => {
        this.alertService.error(`Failed to load discussion prompts: ${error}`, 6000);
      },
    });
  }

  public addNewPrompt() {
    const content = this.newDiscussionPromptContent?.trim();
    const priority = this.newDiscussionPromptWeight;
    if (!content) {
      return;
    }

    this.discussionPromptService
      .create(
        {
          task_definition_id: this.taskDefinition.id,
          content: content,
          priority: priority,
        },
        {
          cache: this.taskDefinition.discussionPromptsCache,
          constructorParams: this.taskDefinition,
        },
      )
      .subscribe({
        next: (_result) => {
          this.cancelNewDiscussionPrompt();
          this.dataSource.data = this.taskDefinition.discussionPromptsCache.currentValuesClone();
          this.alertService.success('Added discussion prompt', 3000);
        },
        error: (error) => {
          this.alertService.error(`Failed to create prompt: ${error}`, 6000);
        },
      });
  }

  public deletePrompt(prompt: DiscussionPrompt) {
    this.confirmationModal.show(
      'Delete discussion prompt',
      'Tutors will no longer see this prompt for this task.',
      () => prompt.delete(),
    );
  }

  createNewDiscussionPrompt() {
    this.cancelEdit();
    this.creatingNewDiscussionPrompt = true;
  }

  cancelNewDiscussionPrompt() {
    this.creatingNewDiscussionPrompt = false;
    this.newDiscussionPromptContent = '';
    this.newDiscussionPromptWeight = 2;
  }

  // Edits go into the form, not the prompt, until they are saved. The fields were
  // bound straight to the prompt, so Cancel left the changed text showing, and the
  // priority field wrote to a property that is never sent, so a new priority was
  // never saved.
  submit() {
    const prompt = this.selected;
    if (!prompt || !this.canSaveEdit) {
      return;
    }

    const content = `${this.formData.value.content}`.trim();
    const priority = Number(this.formData.value.priority);

    this.discussionPromptService
      .put({
        id: prompt.id,
        task_definition_id: this.taskDefinition.id,
        content,
        priority,
      })
      .subscribe({
        next: (_response) => {
          prompt.content = content;
          prompt.priority = priority;
          this.cancelEdit();
          this.alertService.success('Saved discussion prompt', 3000);
        },
        error: (error) => {
          this.alertService.error(`Failed to update prompt: ${error}`, 6000);
        },
      });
  }
}
