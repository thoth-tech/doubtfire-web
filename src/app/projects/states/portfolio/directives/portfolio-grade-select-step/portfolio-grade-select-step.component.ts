/* eslint-disable @typescript-eslint/no-explicit-any */
// portfolio-grade-select-step.component.ts
import {Component, Input, OnInit} from '@angular/core';
import {Grade, Project, ProjectService, Unit} from 'src/app/api/models/doubtfire-model';
import {GradeService} from 'src/app/common/services/grade.service';

@Component({
  selector: 'f-portfolio-grade-select-step',
  templateUrl: './portfolio-grade-select-step.component.html',
  styleUrls: ['./portfolio-grade-select-step.component.scss'],
})
export class PortfolioGradeSelectStepComponent implements OnInit {
  @Input() project: any;
  grades: any;
  agreedToAssessmentCriteria: boolean = false;
  targetGrade: string;
  unit: Unit;
  grade: string;

  constructor(
    private newProjectService: ProjectService,
    private gradeService: GradeService,
  ) {}

  ngOnInit(): void {
    this.grades = this.gradeService.grades;
    this.agreedToAssessmentCriteria = this.projectHasLearningSummaryReport();
  }

  projectHasLearningSummaryReport(): boolean {
    // Replace with the actual implementation for checking if the project has a learning summary report

    return !!this.project?.learningSummaryReport;
  }

  chooseGrade(idx: number): void {
    this.project.submittedGrade = idx;

    this.newProjectService.update(this.project).subscribe((updatedProject) => {
      this.project.refreshBurndownChartData();
    });
  }
}
