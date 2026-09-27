import type {CelebrateTone} from './animated-check.component';

/**
 * When a submission landed, relative to the task's two dates. The target date is
 * the date the student planned to submit by (`Task.localDueDate()`), and the due
 * date is the final deadline for feedback (`Task.localDeadlineDate()`).
 */
export type SubmissionTiming = 'on_time' | 'after_target' | 'after_due';

export interface SubmissionCelebration {
  timing: SubmissionTiming;
  resubmission: boolean;
  tone: CelebrateTone;
  particles: boolean;
  headline: string;
  detail: string;
}

/** Statuses a student resubmits from after a tutor has asked for changes. */
export const RESUBMIT_FROM_STATUSES: readonly string[] = ['fix_and_resubmit', 'redo'];

/**
 * Dates in OnTrack are shown as whole days, so anything submitted during the
 * target or due day itself counts as on that day.
 */
function endOfDay(date: Date): number {
  const end = new Date(date.getTime());
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

function validDate(date: Date | null | undefined): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function classifySubmissionTiming(
  submittedAt: Date,
  targetDate: Date | null | undefined,
  dueDate: Date | null | undefined,
): SubmissionTiming {
  const at = submittedAt.getTime();

  if (validDate(dueDate) && at > endOfDay(dueDate)) {
    return 'after_due';
  }

  if (validDate(targetDate) && at > endOfDay(targetDate)) {
    return 'after_target';
  }

  return 'on_time';
}

export function buildSubmissionCelebration(options: {
  timing: SubmissionTiming;
  resubmission: boolean;
  abbreviation: string;
  name: string;
}): SubmissionCelebration {
  const {timing, resubmission} = options;
  const taskLabel = [options.abbreviation, options.name].filter(Boolean).join(' ');
  const verb = resubmission ? 'Resubmitted' : 'Submitted';

  switch (timing) {
    case 'on_time':
      return {
        timing,
        resubmission,
        tone: 'success',
        particles: true,
        headline: resubmission
          ? 'Resubmitted. Ready for feedback'
          : 'Submitted on time. Ready for feedback',
        detail: taskLabel,
      };
    case 'after_target':
      return {
        timing,
        resubmission,
        tone: 'primary',
        particles: false,
        headline: `${verb}. Ready for feedback`,
        detail: `${taskLabel}. Your tutor will review it.`,
      };
    case 'after_due':
    default:
      return {
        timing: 'after_due',
        resubmission,
        tone: 'neutral',
        particles: false,
        headline: `${verb} after the due date`,
        detail: `${taskLabel} is uploaded. Your tutor can help with what happens next.`,
      };
  }
}
