import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {take} from 'rxjs/operators';
import {
  PeerProgressUnitSummaryViewModel,
  resolvePeerProgressUnitSummaryState,
} from 'src/app/api/models/peer-progress-unit-summary-state';
import {Project} from 'src/app/api/models/project';
import {PeerProgressIndicatorService} from 'src/app/api/services/peer-progress-indicator.service';
import {ProjectService} from 'src/app/api/services/project.service';
import {UserService} from 'src/app/api/services/user.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {calculateCompletionPercentage} from 'src/app/common/services/ppi-progress-calculation.service';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';

@Component({
  selector: 'f-progress-dashboard',
  templateUrl: './progress-dashboard.component.html',
  styleUrls: ['./progress-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ProgressDashboardComponent implements OnChanges, OnInit {
  @Input() project: Project;
  @Input() showSubmittedGrade?: boolean = false;
  @Output() doUpdateTargetGrade: EventEmitter<void> = new EventEmitter();

  grades: {names: Record<number, string>; values: number[]} = {
    names: this.gradeService.grades,
    values: this.gradeService.gradeValues,
  };
  numberOfTasks = {
    completed: 0,
    remaining: 0,
  };
  isUpdatingTargetGrade = false;

  peerProgressView: PeerProgressUnitSummaryViewModel = resolvePeerProgressUnitSummaryState(
    true,
    null,
    null,
  );

  constructor(
    private gradeService: GradeService,
    private peerProgressService: PeerProgressIndicatorService,
    private projectService: ProjectService,
    private alertService: AlertService,
    private userService: UserService,
    readonly demoMode: DemoModeStore,
  ) {}

  ngOnInit(): void {
    this.refreshProjectSummary();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('project' in changes && !changes.project.firstChange) {
      this.refreshProjectSummary();
    }
  }

  private refreshProjectSummary(): void {
    if (!this.project?.unit) {
      return;
    }

    this.grades.values = this.gradeService.gradeValuesFor(this.project.unit);
    this.grades.names = Object.fromEntries(
      this.project.unit.gradeDefinitions.map((definition) => [definition.value, definition.label]),
    );
    this.updateTaskCompletionValues();
    this.loadPeerProgressUnitSummary();
    this.project?.refreshBurndownChartData();
  }

  public get viewingOtherStudentProject(): boolean {
    const role = this.project?.unit?.myRole;
    const currentUser = this.userService.currentUser;

    return !!role && role !== 'Student' && this.project?.student?.id !== currentUser?.id;
  }

  public get showDemoPeerProgress(): boolean {
    return this.demoMode.enabled && !this.viewingOtherStudentProject;
  }

  updateTargetGrade(newGrade: number): void {
    if (
      this.isUpdatingTargetGrade ||
      newGrade === undefined ||
      newGrade === null ||
      newGrade === this.project.targetGrade
    ) {
      return;
    }

    const previousTargetGrade = this.project.targetGrade;
    this.project.targetGrade = newGrade;
    this.isUpdatingTargetGrade = true;

    this.projectService.update(this.project).subscribe({
      next: (project) => {
        this.isUpdatingTargetGrade = false;
        project.refreshBurndownChartData();
        this.updateTaskCompletionValues();
        this.loadPeerProgressUnitSummary();
        this.doUpdateTargetGrade.emit();
        this.alertService.success('Updated target grade successfully', 2000);
      },
      error: (error) => {
        this.isUpdatingTargetGrade = false;
        this.project.targetGrade = previousTargetGrade;
        this.updateTaskCompletionValues();
        this.loadPeerProgressUnitSummary();
        this.doUpdateTargetGrade.emit();
        console.error('Error updating target grade:', error);
        this.alertService.error('Failed to update target grade', 4000);
      },
    });
  }

  private loadPeerProgressUnitSummary(): void {
    if (!this.showDemoPeerProgress) {
      return;
    }

    const availableTasks = this.numberOfTasks.completed + this.numberOfTasks.remaining;

    const studentPercentage = calculateCompletionPercentage(
      this.numberOfTasks.completed,
      availableTasks,
    );

    this.peerProgressView = resolvePeerProgressUnitSummaryState(true, null, null);

    // PPI-F02 demonstration only.
    // A live authorised unit-level API remains future work.
    this.peerProgressService
      .getDemoUnitSummary(
        this.project.unit.id,
        this.project.targetGrade,
        studentPercentage,
        'normal',
      )
      .pipe(take(1))
      .subscribe({
        next: (data) => {
          this.peerProgressView = resolvePeerProgressUnitSummaryState(false, null, data);
        },
        error: (error) => {
          this.peerProgressView = resolvePeerProgressUnitSummaryState(false, error, null);
        },
      });
  }

  private updateTaskCompletionValues(): void {
    const activeTasks = this.project.activeTasks();
    const completedTasks = activeTasks.filter((task) => task.status === 'complete').length;
    this.numberOfTasks = {
      completed: completedTasks,
      remaining: activeTasks.length - completedTasks,
    };
  }
}
