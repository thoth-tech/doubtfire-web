import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {AnimatedCheckComponent} from '../animated-check.component';
import {CelebrationParticlesComponent} from '../celebration-particles.component';
import {MilestoneDialogComponent, MilestoneDialogData} from '../milestone-dialog.component';
import {prefersReducedMotion} from '../reduced-motion';
import {SubmissionCelebrationService} from '../submission-celebration.service';
import {SubmissionTiming, buildSubmissionCelebration} from '../submission-timing';

interface CelebrationTrigger {
  label: string;
  timing: SubmissionTiming;
  resubmission: boolean;
  note: string;
}

interface StatusSample {
  key: string;
  label: string;
  icon: string;
  tone: string;
}

const STATUS_CYCLE: StatusSample[] = [
  {key: 'not_started', label: 'Not started', icon: 'radio_button_unchecked', tone: 'not-started'},
  {key: 'working_on_it', label: 'Working on it', icon: 'edit', tone: 'working-on-it'},
  {
    key: 'ready_for_feedback',
    label: 'Ready for feedback',
    icon: 'send',
    tone: 'ready-for-feedback',
  },
  {key: 'discuss', label: 'Ready to discuss', icon: 'forum', tone: 'discuss'},
  {key: 'complete', label: 'Complete', icon: 'check', tone: 'complete'},
];

/**
 * A place to look at every motion decision on one page. Nothing here ships to a
 * student: it exists so the states can be compared next to each other rather
 * than found one at a time by doing real work in the app.
 *
 * Each candidate carries the frequency that justifies it. An interaction a tutor
 * repeats a hundred times a day gets less motion, not more.
 */
@Component({
  selector: 'app-motion-demo',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, AnimatedCheckComponent, CelebrationParticlesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './motion-demo.component.html',
  styleUrl: './motion-demo.component.scss',
})
export class MotionDemoComponent {
  private readonly celebrations = inject(SubmissionCelebrationService);
  private readonly dialog = inject(MatDialog);

  public readonly reducedMotion = prefersReducedMotion();

  public readonly submissionTriggers: CelebrationTrigger[] = [
    {
      label: 'On time',
      timing: 'on_time',
      resubmission: false,
      note: 'Rare and worth marking. Ring, tick, then one light burst.',
    },
    {
      label: 'On time, resubmitted',
      timing: 'on_time',
      resubmission: true,
      note: 'Same warmth, different words. Getting back on track counts.',
    },
    {
      label: 'After the target date',
      timing: 'after_target',
      resubmission: false,
      note: 'Still positive, no burst. The moment is not a win, it is progress.',
    },
    {
      label: 'After the target date, resubmitted',
      timing: 'after_target',
      resubmission: true,
      note: 'Quieter again. Nothing celebratory, just a clear confirmation.',
    },
    {
      label: 'After the due date',
      timing: 'after_due',
      resubmission: false,
      note: 'Neutral tone. Confirms the upload and points at the tutor.',
    },
    {
      label: 'After the due date, resubmitted',
      timing: 'after_due',
      resubmission: true,
      note: 'The one state where a celebration would read as tone deaf.',
    },
  ];

  // ---- Candidate 1: status pill change -------------------------------------
  public readonly statusIndex = signal(0);
  public readonly statusBridging = signal(false);

  public get status(): StatusSample {
    return STATUS_CYCLE[this.statusIndex() % STATUS_CYCLE.length];
  }

  public advanceStatus(): void {
    // A blur through the swap bridges the two labels, so it reads as one pill
    // changing rather than two pills trading places.
    this.statusBridging.set(true);
    setTimeout(() => {
      this.statusIndex.update((index) => (index + 1) % STATUS_CYCLE.length);
      this.statusBridging.set(false);
    }, 110);
  }

  // ---- Candidate 2: progress bar ------------------------------------------
  public readonly progress = signal(25);

  public bumpProgress(): void {
    this.progress.update((value) => (value >= 100 ? 0 : Math.min(100, value + 25)));
  }

  // ---- Candidate 3: a row that just changed --------------------------------
  public readonly washing = signal(false);

  public washRow(): void {
    this.washing.set(false);
    // Restart the wash even when it is already running.
    requestAnimationFrame(() => this.washing.set(true));
    setTimeout(() => this.washing.set(false), 1200);
  }

  // ---- Candidate 4: comment entry -----------------------------------------
  public readonly comments = signal<{id: number; body: string; mine: boolean}[]>([
    {id: 1, body: 'Have a look at the second requirement before you resubmit.', mine: false},
  ]);
  private nextCommentId = 2;

  public sendComment(): void {
    const id = this.nextCommentId++;
    this.comments.update((rows) => [
      ...rows,
      {id, body: 'Fixed it, thanks. Uploading the new version now.', mine: id % 2 === 0},
    ]);
  }

  public clearComments(): void {
    this.comments.set([]);
    this.nextCommentId = 2;
  }

  // ---- Candidate 5: files landing -----------------------------------------
  public readonly files = signal<string[]>([]);

  public dropFiles(): void {
    this.files.set([]);
    requestAnimationFrame(() =>
      this.files.set(['report.pdf', 'analysis.ipynb', 'screenshot.png', 'notes.md']),
    );
  }

  // ---- Triggers ------------------------------------------------------------
  public playSubmission(trigger: CelebrationTrigger): void {
    this.celebrations.show(
      buildSubmissionCelebration({
        timing: trigger.timing,
        resubmission: trigger.resubmission,
        abbreviation: 'Task 3.1P',
        name: 'Update your company mentor',
      }),
    );
  }

  public playMilestone(size: 'one' | 'several' | 'mixed'): void {
    this.dialog.open<MilestoneDialogComponent, MilestoneDialogData>(MilestoneDialogComponent, {
      data: this.milestoneData(size),
      width: 'min(480px, calc(100vw - 32px))',
      maxWidth: '480px',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'ot-milestone-dialog',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      enterAnimationDuration: this.reducedMotion ? '120ms' : '220ms',
      exitAnimationDuration: this.reducedMotion ? '100ms' : '150ms',
    });
  }

  private milestoneData(size: 'one' | 'several' | 'mixed'): MilestoneDialogData {
    const base: MilestoneDialogData = {
      unitCode: 'SIT374',
      completed: [{taskDefinitionId: 1, abbreviation: '3.1P', name: 'Update your company mentor'}],
      alsoChanged: [],
      progressFrom: 18,
      progressTo: 25,
      targetGradeLabel: 'High Distinction',
    };

    if (size === 'one') {
      return base;
    }

    const completed = [
      {taskDefinitionId: 1, abbreviation: '3.1P', name: 'Update your company mentor'},
      {
        taskDefinitionId: 2,
        abbreviation: '5.2C',
        name: 'Responsible team member progress report',
        grade: 'Credit',
      },
      {
        taskDefinitionId: 3,
        abbreviation: '5.3D',
        name: 'Leadership progress report',
        stars: {earned: 4, max: 5},
      },
    ];

    if (size === 'several') {
      return {...base, completed, progressFrom: 18, progressTo: 44};
    }

    return {
      ...base,
      completed,
      alsoChanged: [
        {
          taskDefinitionId: 4,
          abbreviation: '5.4HD',
          name: 'Panel presentation',
          label: 'Ready to discuss with your tutor',
        },
        {
          taskDefinitionId: 5,
          abbreviation: '4.1P',
          name: 'Update your company mentor (II)',
          label: 'Needs changes',
        },
        {
          taskDefinitionId: 6,
          abbreviation: '2.3D',
          name: 'Lead contributions contract',
          label: 'New feedback',
        },
      ],
      progressFrom: 18,
      progressTo: 44,
    };
  }
}
