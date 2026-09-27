import {ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';
import {ProjectService} from 'src/app/api/services/project.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {
  PORTFOLIO_GRADE_BANDS,
  PortfolioGradeBand,
  gradeBandFor,
  isProjectGraded,
} from '../../portfolio-grades';
import {PortfolioMarkingStateService} from '../../portfolio-marking-state.service';

@Component({
  selector: 'f-portfolios-assessment',
  templateUrl: './portfolios-assessment.component.html',
  styleUrl: './portfolios-assessment.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PortfoliosAssessmentComponent implements OnChanges {
  @Input() project: Project;
  @Input() unit: Unit;

  public readonly gradeResults: readonly PortfolioGradeBand[] = PORTFOLIO_GRADE_BANDS;

  // The rationale being written. The project keeps only what was sent with a grade,
  // because a starting 0 plus a rationale typed into the project would read as graded.
  // The draft lives in the marking state as it is typed, so looking at the portfolio
  // or the progress and coming back to this tab does not lose it.
  public rationale = '';

  constructor(
    private gradeService: GradeService,
    private projectService: ProjectService,
    private alertService: AlertService,
    private markingState: PortfolioMarkingStateService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.project) {
      const draft = this.project ? this.markingState.rationaleDraftFor(this.project.id) : undefined;
      this.rationale = draft ?? this.project?.gradeRationale ?? '';
    }
  }

  public get graded(): boolean {
    return isProjectGraded(this.project);
  }

  public get saving(): boolean {
    return !!this.project && this.markingState.isSavingGrade(this.project.id);
  }

  public get canChooseScore(): boolean {
    return !!this.project && !this.saving && this.rationale.trim().length > 0;
  }

  // Saving on its own is only for the rationale of a grade already given: without a
  // grade it would record the starting 0 as a fail.
  public get canSaveRationale(): boolean {
    return this.graded && this.canChooseScore;
  }

  public get currentBandLabel(): string | null {
    const band = this.graded ? gradeBandFor(this.project.grade) : undefined;
    return band ? this.bandLabel(band) : null;
  }

  public get statusMessage(): string {
    if (this.saving) {
      return 'Saving the grade.';
    }

    if (this.rationale.trim().length === 0) {
      return 'Write a rationale before you choose a score.';
    }

    if (!this.graded) {
      return 'Choosing a score saves it with this rationale.';
    }

    return 'Choosing a score saves it straight away. To change only the rationale, save it.';
  }

  public onRationaleChange(text: string): void {
    this.rationale = text;
    if (this.project) {
      this.markingState.rememberRationaleDraft(this.project.id, text);
    }
  }

  public isSelected(score: number): boolean {
    return this.graded && this.project.grade === score;
  }

  public bandLabel(band: PortfolioGradeBand): string {
    return this.gradeService.gradeLabel(band.gradeValue, this.unit) ?? band.name;
  }

  public bandRange(band: PortfolioGradeBand): string {
    return `${band.scores[0]} to ${band.scores[band.scores.length - 1]}`;
  }

  public chooseScore(score: number): void {
    if (!this.canChooseScore) {
      return;
    }

    this.saveGrade(score);
  }

  public saveRationale(): void {
    if (!this.canSaveRationale) {
      return;
    }

    this.saveGrade(this.project.grade);
  }

  // The same request as Project.assignGrade. That method updates the project before the
  // server answers and, when the save fails, puts back the grade but keeps the new
  // rationale. A first grade that failed then looked like a saved 0, and Save would
  // record that 0 as a fail. So the request is made here, and a failure restores both.
  private saveGrade(score: number): void {
    const project = this.project;
    const previousGrade = project.grade;
    const previousRationale = project.gradeRationale;
    const rationale = this.rationale;

    project.grade = score;
    project.gradeRationale = rationale;
    this.markingState.setSavingGrade(project.id, true);

    // Not cancelled if the tutor moves to another tab: the save still finishes, and a
    // failure still puts the project back.
    this.projectService
      .update(project, {
        body: {
          grade: score,
          old_grade: previousGrade || 0,
          grade_rationale: rationale,
        },
      })
      .subscribe({
        next: () => {
          this.markingState.setSavingGrade(project.id, false);
          // The rationale is saved now, so the draft is no longer needed. A newer one
          // typed while the save was out is kept.
          if (this.markingState.rationaleDraftFor(project.id) === rationale) {
            this.markingState.clearRationaleDraft(project.id);
          }
          this.alertService.success('Grade updated.');
        },
        error: (message) => {
          this.markingState.setSavingGrade(project.id, false);
          project.grade = previousGrade;
          project.gradeRationale = previousRationale;
          this.alertService.error(`Grade was not updated: ${message}`);
        },
      });
  }
}
