import {Injectable, inject} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import type {Project} from 'src/app/api/models/project';
import type {Task} from 'src/app/api/models/task';
import {
  PortfolioCelebrationComponent,
  PortfolioCelebrationData,
  PortfolioCelebrationFact,
} from './portfolio-celebration.component';
import {prefersReducedMotion} from './reduced-motion';

/**
 * Marks the end of a unit's work, when a student sends their portfolio to be
 * built. It is the rarest thing a student does here, so unlike the submission
 * confirmation it waits to be dismissed rather than timing out.
 */
@Injectable({
  providedIn: 'root',
})
export class PortfolioCelebrationService {
  private readonly dialog = inject(MatDialog);

  /** Returns true when a celebration was shown, so the caller can skip its own toast. */
  public celebrate(project: Project, includedTasks: Task[]): boolean {
    try {
      const data = this.describe(project, includedTasks);
      if (!data) {
        return false;
      }

      this.show(data);
      return true;
    } catch {
      return false;
    }
  }

  /** What the dialog says, or null when this viewer should not see one. */
  public describe(project: Project, includedTasks: Task[]): PortfolioCelebrationData | null {
    if (project?.unit?.myRole !== 'Student') {
      return null;
    }

    const count = includedTasks?.length ?? 0;
    const facts: PortfolioCelebrationFact[] = [];

    if (count > 0) {
      facts.push({
        icon: 'task_alt',
        label: 'Work included',
        value: `${count} ${count === 1 ? 'task' : 'tasks'}`,
      });
    }

    const grade = this.gradeLabel(project);
    if (grade) {
      facts.push({icon: 'workspace_premium', label: 'Submitted for', value: grade});
    }

    return {
      unitCode: project.unit?.code ?? '',
      unitName: project.unit?.name ?? undefined,
      headline: 'Portfolio submitted',
      detail:
        'That is the whole unit done. Your portfolio is everything you have worked on this trimester, in one document.',
      facts,
      next: 'It is being built now. That takes a little while, and you will get an email when it is ready to download.',
    };
  }

  public show(data: PortfolioCelebrationData): void {
    const reduced = prefersReducedMotion();
    this.dialog.open<PortfolioCelebrationComponent, PortfolioCelebrationData>(
      PortfolioCelebrationComponent,
      {
        data,
        width: 'min(560px, calc(100vw - 32px))',
        maxWidth: '560px',
        maxHeight: 'calc(100dvh - 32px)',
        panelClass: 'ot-portfolio-dialog',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        enterAnimationDuration: reduced ? '120ms' : '320ms',
        exitAnimationDuration: reduced ? '100ms' : '180ms',
      },
    );
  }

  private gradeLabel(project: Project): string | undefined {
    try {
      return project.targetGradeWord || undefined;
    } catch {
      return undefined;
    }
  }
}
