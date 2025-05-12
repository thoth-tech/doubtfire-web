import {Injectable} from '@angular/core';
import {GradeService} from './grade.service';
import {TaskService} from 'src/app/api/services/task.service';
import {Unit} from 'src/app/api/models/unit';
import {Task} from 'src/app/api/models/task';
import {Project} from 'src/app/api/models/project';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {LearningOutcomeService} from 'src/app/api/services/learning-outcome.service';
import {LearningOutcome} from 'src/app/api/models/doubtfire-model';
import { TaskOutcomeAlignment } from 'src/app/api/models/doubtfire-model';
import {Observable, of} from 'rxjs';
import {catchError} from 'rxjs/operators';

type Grades = Record<number, number | number[]>;

interface Outcomes {
  [key: string | number]: string | Grades | number | number[];
  title?: string;
}

interface ValuePair {
  label: SafeHtml | string;
  value: number;
}

interface Values {
  key: string;
  values: ValuePair[];
}

interface TaskOutcomeAlignmentContainer {
  taskOutcomeAlignments: readonly TaskOutcomeAlignment[] | TaskOutcomeAlignment[];
}

@Injectable({
  providedIn: 'root',
})
export class OutcomeService {
  public alignmentLabels: string[] = [
    'The task is not related to this outcome at all',
    'The task is slightly related to this outcome',
    'The task is related to this outcome',
    'The task is a reasonable example for this outcome',
    'The task is a strong example of this outcome',
    'The task is the best example of this outcome',
  ];

  constructor(
    private gradeService: GradeService,
    private taskService: TaskService,
    private sanitizer: DomSanitizer,
    private learningOutcomeService: LearningOutcomeService,
  ) {}

  getOutcomesForUnit(unitId: number): Observable<readonly LearningOutcome[]> {
    return this.learningOutcomeService.query({
      params: { unitId }
    } as any).pipe(
      catchError(error => {
        console.error('Error fetching learning outcomes:', error);
        return of([]);
      })
    );
  }

  ensureUnitOutcomes(unit: Unit): Observable<readonly LearningOutcome[]> {
    if (unit.ilos && unit.ilos.length > 0) {
      return of(unit.ilos);
    }

    return this.getOutcomesForUnit(unit.id);
  }

  individualTaskStatusFactor(project: Project, task: Task): (taskDefinitionId: number) => number {
    return (taskDefinitionId: number): number => {
      if (task.definition.id === taskDefinitionId) {
        const foundTask = project.findTaskForDefinition(taskDefinitionId);
        if (foundTask && foundTask.status) {
          return this.taskService.learningWeight.get(foundTask.status) || 0;
        }
      }
      return 0;
    };
  }

  /**
   * Returns 1 for the target task's definition ID and 0 for all others
   */
  individualTaskPotentialFactor(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    project: Project,
    task: Task,
  ): (taskDefinitionId: number) => number {
    return (taskDefinitionId: number): number => {
      if (task.definition.id === taskDefinitionId) {
        return 1;
      } else {
        return 0;
      }
    };
  }

  calculateTargets(
    unit: Unit,
    source: TaskOutcomeAlignmentContainer,
    taskStatusFactor: (taskDefinitionId: number) => number,
  ): Outcomes {
    const outcomes: Outcomes = {};

    if (unit.ilos) {
      unit.ilos.forEach((outcome) => {
        outcomes[outcome.id] = {
          0: [], // Pass grade
          1: [], // Credit grade
          2: [],
          3: [],
        };
      });
    } else {
      console.warn('Unit does not have loaded learning outcomes (ilos)');
    }

    if (source && source.taskOutcomeAlignments) {
      source.taskOutcomeAlignments.forEach((align) => {
        if (!align.learningOutcome || !align.taskDefinition) return;

        const td = unit.taskDef(align.taskDefinition.id);
        if (!td) return;

        const outcomeId = align.learningOutcome.id;
        const gradeOutcomes = outcomes[outcomeId] as Grades;

        if (!gradeOutcomes) return;

        const targetGradeArray = gradeOutcomes[td.targetGrade] as number[];
        if (!Array.isArray(targetGradeArray)) return;

        targetGradeArray.push(align.rating * taskStatusFactor(td.id));
      });
    }

    Object.keys(outcomes).forEach((outcomeKey) => {
      const outcomeId = parseInt(outcomeKey, 10);
      if (isNaN(outcomeId)) return;

      const outcome = outcomes[outcomeId] as Grades;

      [0, 1, 2, 3].forEach((gradeKey) => {
        // Apply the grade scale (2^grade)
        const gradeScale = Math.pow(2, gradeKey);
        const gradeArray = outcome[gradeKey] as number[];

        // Reduce the array of values to a single score
        outcome[gradeKey] = gradeArray.reduce((sum, num) => sum + num, 0) * gradeScale;
      });
    });

    return outcomes;
  }

  calculateTaskContribution(unit: Unit, project: Project, task: Task): Outcomes[] {
    const outcomeSet: Outcomes[] = [];

    outcomeSet[0] = this.calculateTargets(
      unit,
      unit as TaskOutcomeAlignmentContainer,
      this.individualTaskStatusFactor(project, task),
    );

    this.sumGradesForOutcomes(outcomeSet[0]);

    outcomeSet[0].title = 'Current Task Contribution';
    return outcomeSet;
  }

  /**
   * Calculate the potential contribution of a task to learning outcomes
   * (ignoring current task status)
   */
  calculateTaskPotentialContribution(unit: Unit, project: Project, task: Task): Outcomes {
    const outcomes = this.calculateTargets(
      unit,
      unit as TaskOutcomeAlignmentContainer,
      this.individualTaskPotentialFactor(project, task),
    );

    this.sumGradesForOutcomes(outcomes);

    outcomes['title'] = 'Potential Task Contribution';
    return outcomes;
  }

  calculateProgress(unit: Unit, project: Project): Outcomes[] {
    const outcomeSet: Outcomes[] = [];

    const taskStatusFactorAdapter = (taskDefinitionId: number): number => {
      const task = project.findTaskForDefinition(taskDefinitionId);
      if (!task) return 0;
      return this.taskService.learningWeight.get(task.status) || 0;
    };

    outcomeSet[0] = this.calculateTargets(
      unit,
      unit as TaskOutcomeAlignmentContainer,
      taskStatusFactorAdapter,
    );

    this.sumGradesForOutcomes(outcomeSet[0]);

    outcomeSet[0].title = 'Your Progress';
    return outcomeSet;
  }

  private createTaskStatusFactorWrapper(unit: Unit): (taskDef: TaskDefinition) => number {
    return (taskDef: TaskDefinition): number => {
      if (!taskDef) return 0;

      try {
        if (typeof unit.taskStatusFactor === 'function') {
          return unit.taskStatusFactor(taskDef);
        }
      } catch (error) {
        console.error('Error calling unit.taskStatusFactor:', error);
      }

      return 0;
    };
  }

  private sumGradesForOutcomes(outcomes: Outcomes): void {
    Object.keys(outcomes).forEach((key) => {
      if (key === 'title') return;

      const outcomeId = parseInt(key, 10);
      if (isNaN(outcomeId)) return;

      const outcome = outcomes[outcomeId] as Grades;

      if (typeof outcome === 'object') {
        outcomes[outcomeId] = [0, 1, 2, 3].reduce(
          (memo, gradeKey) => {
            const gradeValue = outcome[gradeKey];
            return memo + (typeof gradeValue === 'number' ? gradeValue : 0);
          },
          0,
        );
      }
    });
  }

  /**
   * Group learning outcomes by grade for visualization
   */
  targetsByGrade(unit: Unit, source: TaskOutcomeAlignmentContainer): Values[] {
    const result: Values[] = [];

    const taskStatusFactorAdapter = (taskDefinitionId: number): number => {
      const taskDef = unit.taskDef(taskDefinitionId);
      if (!taskDef) return 0;
      return this.createTaskStatusFactorWrapper(unit)(taskDef);
    };

    const outcomes = this.calculateTargets(unit, source, taskStatusFactorAdapter);

    const values: Record<string, ValuePair[]> = {
      '0': [],
      '1': [],
      '2': [],
      '3': [],
    };

    Object.keys(outcomes).forEach((key) => {
      if (key === 'title') return;

      const outcomeId = parseInt(key, 10);
      if (isNaN(outcomeId)) return;

      const outcome = outcomes[outcomeId] as Grades;
      const outcomeObj = unit.outcome(outcomeId);

      if (!outcomeObj) return;

      [0, 1, 2, 3].forEach((gradeKey) => {
        const gradeValue = outcome[gradeKey];
        if (typeof gradeValue !== 'number') return;

        values[gradeKey].push({
          label: this.sanitizer.bypassSecurityTrustHtml(outcomeObj.abbreviation),
          value: gradeValue,
        });
      });
    });

    Object.keys(values).forEach((idx) => {
      const gradeIndex = parseInt(idx, 10);

      if (!this.gradeService.grades[gradeIndex]) return;

      result.push({
        key: this.gradeService.grades[gradeIndex],
        values: values[idx],
      });
    });

    return result;
  }
}
