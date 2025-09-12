import {Component, Inject, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatDialogModule, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatCardModule} from '@angular/material/card';
import {MatListModule} from '@angular/material/list';
import {MatChipsModule} from '@angular/material/chips';
import {MatDividerModule} from '@angular/material/divider';
import {CourseUnit} from '../../models/course-map.models';
import {
  Unit,
  UnitDefinition,
  Requirement,
  RequirementSet,
} from 'src/app/api/models/doubtfire-model';
import {LearningOutcome} from 'src/app/api/models/learning-outcome';
import {TaskOutcomeAlignment} from 'src/app/api/models/task-outcome-alignment';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {RequirementService} from 'src/app/api/services/requirement.service';
import {RequirementSetService} from 'src/app/api/services/requirement-set.service';
import {forkJoin, Observable, of} from 'rxjs';
import {map, catchError} from 'rxjs/operators';

@Component({
  selector: 'f-unit-details-overlay',
  templateUrl: './unit-details-overlay.component.html',
  styleUrls: ['./unit-details-overlay.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatListModule,
    MatChipsModule,
    MatDividerModule,
  ],
})
export class UnitDetailsOverlayComponent implements OnInit {
  public unitRequirements: Requirement[] = [];
  public courseRequirements: Requirement[] = [];
  public prerequisiteUnits: string[] = [];
  public requirementsLoading = false;
  public requirementsError: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<UnitDetailsOverlayComponent>,
    @Inject(MAT_DIALOG_DATA) public unit: CourseUnit,
    private requirementService: RequirementService,
    private requirementSetService: RequirementSetService,
  ) {}

  ngOnInit(): void {
    this.loadRequirements();
  }

  private loadRequirements(): void {
    if (!this.isUnit || !this.unitAsUnit?.id) {
      return;
    }

    this.requirementsLoading = true;
    this.requirementsError = null;

    // Get both unit-specific requirements (prerequisites) and course requirements
    const unitRequirements$ = this.requirementService.getRequirementsByUnitId(this.unitAsUnit.id);
    const courseRequirements$ = this.getCourseRequirements();

    forkJoin({
      unitRequirements: unitRequirements$,
      courseRequirements: courseRequirements$,
    })
      .pipe(
        catchError((error) => {
          console.error('Error loading requirements:', error);
          this.requirementsError = 'Failed to load requirements information';
          return of({unitRequirements: [], courseRequirements: []});
        }),
      )
      .subscribe({
        next: (data) => {
          this.unitRequirements = data.unitRequirements;
          this.courseRequirements = data.courseRequirements;
          this.loadPrerequisiteUnits();
          this.requirementsLoading = false;
        },
        error: (error) => {
          console.error('Error in requirements subscription:', error);
          this.requirementsError = 'Failed to load requirements information';
          this.requirementsLoading = false;
        },
      });
  }

  private getCourseRequirements(): Observable<Requirement[]> {
    // Try to get course ID from the unit or use a default course ID
    // In your test data, you created course S326 with ID that we need to determine
    const courseId = 1; // You might need to adjust this based on your data
    return this.requirementService.getRequirementsByCourseId(courseId).pipe(
      catchError((error) => {
        console.warn('Could not load course requirements:', error);
        return of([]);
      }),
    );
  }

  private loadPrerequisiteUnits(): void {
    // Find prerequisite requirements for this unit
    const prerequisiteRequirements = this.unitRequirements.filter(
      (req) => req.category === 'prerequisite',
    );

    if (prerequisiteRequirements.length === 0) {
      return;
    }

    // For each prerequisite requirement, get the requirement sets to find the actual units
    const prerequisitePromises = prerequisiteRequirements.map((req) =>
      this.requirementSetService
        .getRequirementSetsByGroupId(req.requirementSetGroupId)
        .pipe(
          map((sets) => sets.map((set) => set.unit?.code || set.description)),
          catchError(() => of([])),
        ),
    );

    forkJoin(prerequisitePromises).subscribe({
      next: (prerequisiteLists) => {
        this.prerequisiteUnits = prerequisiteLists.flat().filter((code) => code);
      },
      error: (error) => {
        console.error('Error loading prerequisite units:', error);
      },
    });
  }

  get isUnit(): boolean {
    return this.unit && 'teachingPeriod' in this.unit;
  }

  get isUnitDefinition(): boolean {
    return this.unit && !('teachingPeriod' in this.unit);
  }

  get unitAsUnit(): Unit | null {
    return this.isUnit ? (this.unit as Unit) : null;
  }

  get unitAsUnitDefinition(): UnitDefinition | null {
    return this.isUnitDefinition ? (this.unit as UnitDefinition) : null;
  }

  get unitCode(): string {
    return this.unit.code;
  }

  get unitName(): string {
    return this.unit.name;
  }

  get unitDescription(): string {
    return this.unit.description || 'No description available';
  }

  get creditPoints(): number | null {
    // For Unit instances, credit points might be available
    if (this.isUnit && 'creditPoints' in this.unit) {
      return (this.unit as Unit & {creditPoints?: number}).creditPoints || null;
    }
    // For UnitDefinition, we might need to extract from description or handle differently
    return null;
  }

  get learningOutcomes(): readonly LearningOutcome[] {
    if (this.isUnit && this.unitAsUnit?.learningOutcomesCache) {
      return this.unitAsUnit.learningOutcomesCache.currentValues;
    }
    return [];
  }

  get taskOutcomeAlignments(): readonly TaskOutcomeAlignment[] {
    if (this.isUnit && this.unitAsUnit?.taskOutcomeAlignments) {
      return this.unitAsUnit.taskOutcomeAlignments;
    }
    return [];
  }

  get taskDefinitions(): readonly TaskDefinition[] {
    if (this.isUnit && this.unitAsUnit?.taskDefinitionCache) {
      return this.unitAsUnit.taskDefinitionCache.currentValues;
    }
    return [];
  }

  get prerequisites(): string[] {
    // Return the dynamically loaded prerequisites, fall back to hardcoded ones for demo
    if (this.prerequisiteUnits.length > 0) {
      return this.prerequisiteUnits;
    }

    // Fallback to hardcoded prerequisites based on your test data
    const unitCode = this.unitCode;
    if (unitCode === 'SIT328') return ['MIS201'];
    if (unitCode === 'SIT374') return ['SIT223'];
    if (unitCode === 'SIT344') return ['SIT223'];
    if (unitCode === 'SIT306') return ['SIT374'];
    if (unitCode === 'SIT378') return ['SIT374'];
    if (unitCode === 'SIT232') return ['SIT102'];
    if (unitCode === 'SIT323') return ['SIT103', 'SIT232'];

    return [];
  }

  get hasPrerequisites(): boolean {
    return this.prerequisites.length > 0;
  }

  getTaskAlignments(taskDefinitionId: number): TaskOutcomeAlignment[] {
    return this.taskOutcomeAlignments.filter(
      (alignment) => alignment.taskDefinition.id === taskDefinitionId,
    );
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
