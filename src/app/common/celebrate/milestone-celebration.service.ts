import {Injectable, inject} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {firstValueFrom} from 'rxjs';
import type {Project} from 'src/app/api/models/project';
import type {TaskStatusEnum} from 'src/app/api/models/task-status';
import {UserService} from 'src/app/api/services/user.service';
import {
  MilestoneChangeRow,
  MilestoneDialogComponent,
  MilestoneDialogData,
  MilestoneDialogResult,
  MilestoneTaskRow,
} from './milestone-dialog.component';
import {prefersReducedMotion} from './reduced-motion';
import {SeenStatusMap, TaskStatusSeenService, TaskStatusSnapshot} from './task-status-seen.service';

export interface MilestoneCheckOptions {
  /** Local testing only. Shows the current completed tasks and leaves storage alone. */
  preview?: boolean;
}

/**
 * Decides whether a student opening their unit should see the signed off dialog,
 * builds what it shows, and records the statuses so each change plays once.
 */
@Injectable({
  providedIn: 'root',
})
export class MilestoneCelebrationService {
  private readonly dialog = inject(MatDialog);
  private readonly userService = inject(UserService);
  private readonly seen = inject(TaskStatusSeenService);

  /** Resolves with the choice made in the dialog, or null when nothing was shown. */
  public async checkProject(
    project: Project,
    options: MilestoneCheckOptions = {},
  ): Promise<MilestoneDialogResult | null> {
    const data = this.prepare(project, options);
    if (!data) {
      return null;
    }

    const reduced = prefersReducedMotion();
    const dialogRef = this.dialog.open<
      MilestoneDialogComponent,
      MilestoneDialogData,
      MilestoneDialogResult
    >(MilestoneDialogComponent, {
      data,
      width: 'min(480px, calc(100vw - 32px))',
      maxWidth: '480px',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'ot-milestone-dialog',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      enterAnimationDuration: reduced ? '120ms' : '220ms',
      exitAnimationDuration: reduced ? '100ms' : '150ms',
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    return result === 'view' ? 'view' : 'close';
  }

  /**
   * Works out the dialog contents, and records the statuses for a real visit. Returns
   * null for staff, a first visit, or a visit where nothing was signed off.
   */
  public prepare(
    project: Project,
    options: MilestoneCheckOptions = {},
  ): MilestoneDialogData | null {
    try {
      const unit = project?.unit;
      const definitions = unit?.taskDefinitions ?? [];
      if (!project?.id || definitions.length === 0) {
        return null;
      }

      const snapshots: TaskStatusSnapshot[] = definitions.map((definition) => ({
        taskDefinitionId: definition.id,
        status: project.findTaskForDefinition(definition.id)?.status ?? 'not_started',
      }));

      if (options.preview) {
        const completed = snapshots
          .filter((snapshot) => snapshot.status === 'complete')
          .map((snapshot) => snapshot.taskDefinitionId);
        return completed.length > 0 ? this.buildData(project, completed, [], [], null) : null;
      }

      if (!this.isOwnStudentProject(project)) {
        return null;
      }

      const userId = this.userService.currentUser.id;
      const changes = this.seen.detectChanges(userId, project.id, snapshots);
      // Recorded now, whatever happens next, so a change plays once and a first
      // visit quietly starts from what is already there.
      this.seen.record(userId, project.id, snapshots);

      if (changes.firstVisit || changes.completed.length === 0) {
        return null;
      }

      return this.buildData(
        project,
        changes.completed,
        changes.readyToDiscuss,
        changes.needsChanges,
        changes.previous,
      );
    } catch {
      return null;
    }
  }

  private isOwnStudentProject(project: Project): boolean {
    if (project.unit?.myRole !== 'Student') {
      return false;
    }

    const userId = this.userService?.currentUser?.id;
    if (!userId) {
      return false;
    }

    const studentId = project.student?.id;
    return studentId === undefined || studentId === null || studentId === userId;
  }

  private buildData(
    project: Project,
    completedIds: number[],
    discussIds: number[],
    needsChangesIds: number[],
    previous: SeenStatusMap | null,
  ): MilestoneDialogData {
    const unit = project.unit;
    const definitions = unit.taskDefinitions;
    const completedSet = new Set(completedIds);

    const completed: MilestoneTaskRow[] = definitions
      .filter((definition) => completedSet.has(definition.id))
      .map((definition) => {
        const task = project.findTaskForDefinition(definition.id);
        const row: MilestoneTaskRow = {
          taskDefinitionId: definition.id,
          abbreviation: definition.abbreviation,
          name: definition.name,
        };

        if (task?.hasGrade?.()) {
          const grade = task.gradeDesc?.();
          if (grade) {
            row.grade = grade;
          }
        }

        if (task?.hasQualityPoints?.()) {
          row.stars = {earned: task.qualityPts, max: definition.maxQualityPts};
        }

        return row;
      });

    const alsoChanged: MilestoneChangeRow[] = [];
    const addChange = (id: number, label: string) => {
      const definition = definitions.find((candidate) => candidate.id === id);
      if (definition && !completedSet.has(id)) {
        alsoChanged.push({
          taskDefinitionId: id,
          abbreviation: definition.abbreviation,
          name: definition.name,
          label,
        });
      }
    };

    discussIds.forEach((id) => addChange(id, 'Ready to discuss with your tutor'));
    needsChangesIds.forEach((id) => addChange(id, 'Needs changes'));

    const alreadyListed = new Set(alsoChanged.map((change) => change.taskDefinitionId));
    definitions.forEach((definition) => {
      const task = project.findTaskForDefinition(definition.id);
      if ((task?.numNewComments ?? 0) > 0 && !alreadyListed.has(definition.id)) {
        addChange(definition.id, 'New feedback');
      }
    });

    const {from, to} = this.progress(project, completedSet, previous);

    return {
      unitCode: unit.code ?? '',
      completed,
      alsoChanged,
      progressFrom: from,
      progressTo: to,
      targetGradeLabel: this.targetGradeLabel(project),
    };
  }

  /**
   * Share of the target grade's tasks that are signed off, before and after.
   * Before comes from the stored statuses. A preview has none, so it takes the
   * listed tasks back out instead.
   */
  private progress(
    project: Project,
    completedSet: Set<number>,
    previous: SeenStatusMap | null,
  ): {from: number; to: number} {
    const targets = project.unit.taskDefinitionsForGrade?.(project.targetGrade) ?? [];
    if (targets.length === 0) {
      return {from: 0, to: 0};
    }

    // Counted by task, the same way the progress dashboard says "4 of 16 tasks
    // complete", so the two numbers on screen agree.
    const total = targets.length;
    const statusOf = (id: number): TaskStatusEnum | undefined =>
      project.findTaskForDefinition(id)?.status;

    const done = targets.filter((definition) => statusOf(definition.id) === 'complete').length;

    const before = previous
      ? targets.filter((definition) => previous[String(definition.id)] === 'complete').length
      : done - targets.filter((definition) => completedSet.has(definition.id)).length;

    return {
      from: Math.round((Math.max(0, before) / total) * 100),
      to: Math.round((done / total) * 100),
    };
  }

  private targetGradeLabel(project: Project): string | undefined {
    try {
      return project.targetGradeWord || undefined;
    } catch {
      return undefined;
    }
  }
}
