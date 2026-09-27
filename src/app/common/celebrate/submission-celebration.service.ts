import {LiveAnnouncer} from '@angular/cdk/a11y';
import {OverlayRef, createGlobalPositionStrategy, createOverlayRef} from '@angular/cdk/overlay';
import {ComponentPortal} from '@angular/cdk/portal';
import {ComponentRef, Injectable, Injector, inject} from '@angular/core';
import type {Task} from 'src/app/api/models/task';
import type {TaskStatusEnum} from 'src/app/api/models/task-status';
import {
  SUBMISSION_CELEBRATION_EXIT_MS,
  SubmissionCelebrationComponent,
} from './submission-celebration.component';
import {
  RESUBMIT_FROM_STATUSES,
  SubmissionCelebration,
  buildSubmissionCelebration,
  classifySubmissionTiming,
} from './submission-timing';

/** How long the confirmation stays before it leaves on its own. */
export const SUBMISSION_CELEBRATION_VISIBLE_MS = 2500;

/**
 * Shows the Ready for Feedback confirmation. Only a student's own submission gets
 * one. It dismisses itself after a moment, or on click or Escape.
 */
@Injectable({
  providedIn: 'root',
})
export class SubmissionCelebrationService {
  private readonly injector = inject(Injector);
  private readonly announcer = inject(LiveAnnouncer);

  private overlayRef: OverlayRef | null = null;
  private componentRef: ComponentRef<SubmissionCelebrationComponent> | null = null;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.dismiss();
    }
  };

  /**
   * Describes the celebration for a task that has just become Ready for Feedback,
   * or null when this viewer should not see one.
   */
  public describe(
    task: Task,
    previousStatus: TaskStatusEnum | undefined,
    now: Date = new Date(),
  ): SubmissionCelebration | null {
    if (task?.unit?.myRole !== 'Student') {
      return null;
    }

    const timing = classifySubmissionTiming(now, task.localDueDate(), task.localDeadlineDate());

    return buildSubmissionCelebration({
      timing: task.status === 'time_exceeded' ? 'after_due' : timing,
      resubmission: !!previousStatus && RESUBMIT_FROM_STATUSES.includes(previousStatus),
      abbreviation: task.definition?.abbreviation ?? '',
      name: task.definition?.name ?? '',
    });
  }

  /** Returns true when a celebration was shown, so the caller can skip its own toast. */
  public celebrate(task: Task, previousStatus: TaskStatusEnum | undefined): boolean {
    try {
      const celebration = this.describe(task, previousStatus);
      if (!celebration) {
        return false;
      }

      this.show(celebration);
      return true;
    } catch {
      return false;
    }
  }

  public show(celebration: SubmissionCelebration): void {
    this.dispose();

    const positionStrategy = createGlobalPositionStrategy(this.injector)
      .centerHorizontally()
      .bottom('calc(24px + env(safe-area-inset-bottom, 0px))');
    this.overlayRef = createOverlayRef(this.injector, {
      positionStrategy,
      hasBackdrop: false,
      panelClass: 'ot-submission-celebration-pane',
    });

    const componentRef = this.overlayRef.attach(
      new ComponentPortal(SubmissionCelebrationComponent, null, this.injector),
    );
    componentRef.setInput('celebration', celebration);
    componentRef.instance.dismiss.subscribe(() => this.dismiss());
    this.componentRef = componentRef;

    document.addEventListener('keydown', this.onKeydown);
    this.dismissTimer = setTimeout(() => this.dismiss(), SUBMISSION_CELEBRATION_VISIBLE_MS);

    void this.announcer.announce(`${celebration.headline}. ${celebration.detail}`, 'polite');
  }

  public dismiss(): void {
    const componentRef = this.componentRef;
    const overlayRef = this.overlayRef;
    if (!componentRef || !overlayRef) {
      return;
    }

    this.clearListeners();
    componentRef.instance.leave();
    this.componentRef = null;
    this.overlayRef = null;

    const exitMs = componentRef.instance.reducedMotion ? 120 : SUBMISSION_CELEBRATION_EXIT_MS;
    setTimeout(() => overlayRef.dispose(), exitMs);
  }

  private dispose(): void {
    this.clearListeners();
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.componentRef = null;
  }

  private clearListeners(): void {
    document.removeEventListener('keydown', this.onKeydown);
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
  }
}
