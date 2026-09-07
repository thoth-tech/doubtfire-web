import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {UploadRequirement} from 'src/app/api/models/task-definition';
import {summariseUploadRequirement, UploadRequirementSummary} from './upload-category';

/**
 * Shows the accepted file category, formats and required file count for a task's
 * upload requirements before a student opens the file picker or drops a file.
 *
 * This is a display-only component: file selection, drag-and-drop and rejected-file
 * feedback all remain owned by the existing `file-uploader` directive.
 */
@Component({
  selector: 'f-task-upload-requirements',
  templateUrl: './task-upload-requirements.component.html',
  styleUrls: ['./task-upload-requirements.component.scss'],
})
export class TaskUploadRequirementsComponent implements OnChanges {
  @Input() requirements: UploadRequirement[] | null | undefined;

  // Static id: only one submission modal (and therefore one instance of this
  // component) is ever open at a time, so a fixed id is safe to reference from
  // the modal template via aria-describedby.
  public readonly elementId = 'task-upload-requirements';

  public summaries: UploadRequirementSummary[] = [];
  private expandedKeys = new Set<string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.requirements) {
      this.summaries = (this.requirements ?? []).map((requirement) =>
        summariseUploadRequirement(requirement),
      );
      this.expandedKeys.clear();
    }
  }

  public get hasRequirements(): boolean {
    return this.summaries.length > 0;
  }

  public get requiredFileCount(): number {
    return this.summaries.length;
  }

  public isExpanded(summary: UploadRequirementSummary): boolean {
    return this.expandedKeys.has(summary.key);
  }

  public toggleExpanded(summary: UploadRequirementSummary): void {
    if (this.expandedKeys.has(summary.key)) {
      this.expandedKeys.delete(summary.key);
    } else {
      this.expandedKeys.add(summary.key);
    }
  }
}
