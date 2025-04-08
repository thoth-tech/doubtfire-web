import {Injectable} from '@angular/core';
import {GradeService} from './grade.service';
import {TaskService} from 'src/app/api/services/task.service';
import {Unit} from 'src/app/api/models/unit';
import {Task} from 'src/app/api/models/task';
import {Project} from 'src/app/api/models/project';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {TaskOutcomeAlignment} from 'src/app/api/models/task-outcome-alignment';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';

interface Grades {
  [gradeLevel: number]: number | number[];
}

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
    'The task is a reasonable example for this outcome',
    'The task is related to this outcome',
    'The task is a strong example of this outcome',
    'The task is the best example of this outcome',
  ];

  constructor(
    private gradeService: GradeService,
    private taskService: TaskService,
    private sanitizer: DomSanitizer,
  ) {}

  individualTaskStatusFactor(project: Project, task: Task): (taskDefinitionId: number) => number {
    return (taskDefinitionId: number): number => {
      if (task.definition.id === taskDefinitionId) {
        return this.taskService.learningWeight.get(
          project.findTaskForDefinition(taskDefinitionId).status,
        );
      } else {
        return 0;
      }
    };
  }

  individualTaskPotentialFactor(
    _project: Project,
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

    unit.ilos.forEach((outcome) => {
      outcomes[outcome.id] = {
        0: [], // Pass grade
        1: [], // Credit grade
        2: [],
        3: [],
      };
    });

    source.taskOutcomeAlignments.forEach((align) => {
      const td = unit.taskDef(align.taskDefinition.id);
      const gradeOutcomes = outcomes[align.learningOutcome.id] as Grades;
      const targetGradeArray = gradeOutcomes[td.targetGrade] as number[];

      targetGradeArray.push(align.rating * taskStatusFactor(td.id));
    });

    Object.keys(outcomes).forEach((outcomeKey) => {
      const outcomeId = parseInt(outcomeKey, 10);
      if (isNaN(outcomeId)) return;

      const outcome = outcomes[outcomeId] as Grades;

      [0, 1, 2, 3].forEach((gradeKey) => {
        const gradeScale = Math.pow(2, gradeKey);
        const gradeArray = outcome[gradeKey] as number[];

        outcome[gradeKey] = gradeArray.reduce((sum, num) => sum + num, 0) * gradeScale;
      });
    });

    return outcomes;
  }

  calculateTaskContribution(unit: Unit, project: Project, task: Task): Outcomes[] {
    const outcomeSet: Outcomes[] = [];

    outcomeSet[0] = this.calculateTargets(
      unit,
      unit as unknown as TaskOutcomeAlignmentContainer,
      this.individualTaskStatusFactor(project, task),
    );

    this.sumGradesForOutcomes(outcomeSet[0]);

    outcomeSet[0].title = 'Current Task Contribution';
    return outcomeSet;
  }

  calculateTaskPotentialContribution(unit: Unit, project: Project, task: Task): Outcomes {
    const outcomes = this.calculateTargets(
      unit,
      unit as unknown as TaskOutcomeAlignmentContainer,
      this.individualTaskPotentialFactor(project, task),
    );

    this.sumGradesForOutcomes(outcomes);

    outcomes['title'] = 'Potential Task Contribution';
    return outcomes;
  }

  calculateProgress(unit: Unit, _project: Project): Outcomes[] {
    const outcomeSet: Outcomes[] = [];

    const taskStatusFactorAdapter = (taskDefinitionId: number): number => {
      const taskDef = unit.taskDef(taskDefinitionId);
      return this.createTaskStatusFactorWrapper(unit)(taskDef);
    };

    outcomeSet[0] = this.calculateTargets(
      unit,
      unit as unknown as TaskOutcomeAlignmentContainer,
      taskStatusFactorAdapter,
    );

    this.sumGradesForOutcomes(outcomeSet[0]);

    outcomeSet[0].title = 'Your Progress';
    return outcomeSet;
  }

  private createTaskStatusFactorWrapper(unit: Unit): (taskDef: TaskDefinition) => number {
    return (taskDef: TaskDefinition): number => {
      return unit.taskStatusFactor(taskDef);
    };
  }

  private sumGradesForOutcomes(outcomes: Outcomes): void {
    Object.keys(outcomes).forEach((key) => {
      if (isNaN(parseInt(key, 10))) return;

      const outcomeId = parseInt(key, 10);
      const outcome = outcomes[outcomeId] as Grades;

      if (typeof outcome === 'object') {
        outcomes[outcomeId] = [0, 1, 2, 3].reduce(
          (memo, gradeKey) => memo + (outcome[gradeKey] as number),
          0,
        );
      }
    });
  }

  targetsByGrade(unit: Unit, source: TaskOutcomeAlignmentContainer): Values[] {
    const result: Values[] = [];

    const taskStatusFactorAdapter = (taskDefinitionId: number): number => {
      const taskDef = unit.taskDef(taskDefinitionId);
      return this.createTaskStatusFactorWrapper(unit)(taskDef);
    };

    const outcomes = this.calculateTargets(unit, source, taskStatusFactorAdapter);

    const values: {[key: string]: ValuePair[]} = {
      '0': [],
      '1': [],
      '2': [],
      '3': [],
    };

    Object.keys(outcomes).forEach((key) => {
      if (isNaN(parseInt(key, 10))) return;

      const outcomeId = parseInt(key, 10);
      const outcome = outcomes[outcomeId] as Grades;
      const outcomeObj = unit.outcome(outcomeId);

      if (!outcomeObj) return;

      [0, 1, 2, 3].forEach((gradeKey) => {
        values[gradeKey].push({
          label: this.sanitizer.bypassSecurityTrustHtml(outcomeObj.abbreviation),
          value: outcome[gradeKey] as number,
        });
      });
    });

    Object.keys(values).forEach((idx) => {
      const gradeIndex = parseInt(idx, 10);
      result.push({
        key: this.gradeService.grades[gradeIndex],
        values: values[idx],
      });
    });

    return result;
  }
}
