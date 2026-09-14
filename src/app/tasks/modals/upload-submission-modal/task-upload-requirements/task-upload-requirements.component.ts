import {ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {UploadRequirement} from 'src/app/api/models/task-definition';
import {UploadRequirementSummary, summariseUploadRequirement} from './upload-category';

let nextRequirementsId = 0;

/**
 * Shows the accepted file category, formats and required file count for a task's
 * upload requirements before a student opens the file picker or drops a file.
 *
 * This is a display-only component: file selection, drag-and-drop and rejected-file
 * feedback all remain owned by the existing `f-file-uploader` component.
 */
@Component({
  selector: 'f-task-upload-requirements',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './task-upload-requirements.component.html',
  styleUrls: ['./task-upload-requirements.component.scss'],
})
export class TaskUploadRequirementsComponent implements OnChanges {
  @Input() requirements: UploadRequirement[] | null | undefined;

  public readonly elementId = `task-upload-requirements-${nextRequirementsId++}`;

  public summaries: UploadRequirementSummary[] = [];
  private expandedKeys: Set<string> = new Set();

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
