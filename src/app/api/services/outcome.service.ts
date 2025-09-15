import {Injectable} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {GradeService} from '../models/doubtfire-model';
import {TaskService} from '../models/doubtfire-model';

@Injectable({
  providedIn: 'root',
})
export class OutcomeService {
  alignmentLabels: string[] = [
    'The task is not related to this outcome at all',
    'The task is slightly related to this outcome',
    'The task is related to this outcome',
    'The task is a reasonable example for this outcome',
    'The task is a strong example of this outcome',
    'The task is the best example of this outcome',
  ];

  constructor(
    private sanitizer: DomSanitizer,
    private gradeService: GradeService,
    private taskService: TaskService,
  ) {}

  individualTaskStatusFactor(project: any, task: any) {
    return (taskDefinitionId: any) => {
      if (task.definition.id === taskDefinitionId) {
        return this.taskService.learningWeight.get(
          project.findTaskForDefinition(taskDefinitionId).status,
        );
      } else {
        return 0;
      }
    };
  }

  individualTaskPotentialFactor(project: any, task: any) {
    return (taskDefinitionId: any) => {
      return task.definition.id === taskDefinitionId ? 1 : 0;
    };
  }

  calculateTargets(unit: any, source: any, taskStatusFactor: (td: any) => number) {
    const outcomes: any = {};

    unit.ilos.forEach((outcome: any) => {
      outcomes[outcome.id] = {0: [], 1: [], 2: [], 3: []};
    });

    source.taskOutcomeAlignments.forEach((align: any) => {
      const td = unit.taskDef(align.taskDefinition.id);
      outcomes[align.learningOutcome.id][td.targetGrade].push(align.rating * taskStatusFactor(td));
    });

    Object.keys(outcomes).forEach((key) => {
      const outcome = outcomes[key];
      Object.keys(outcome).forEach((gradeKey) => {
        const scale = Math.pow(2, parseInt(gradeKey, 10));
        outcome[gradeKey] =
          outcome[gradeKey].reduce((memo: number, num: number) => memo + num, 0) * scale;
      });
    });

    return outcomes;
  }

  calculateTaskContribution(unit: any, project: any, task: any) {
    const outcomeSet: any[] = [];
    outcomeSet[0] = this.calculateTargets(
      unit,
      unit,
      this.individualTaskStatusFactor(project, task),
    );

    Object.keys(outcomeSet[0]).forEach((key) => {
      outcomeSet[0][key] = Object.values(outcomeSet[0][key] as any).reduce(
        (memo: number, num: any) => memo + (num as number),
        0,
      );
    });

    outcomeSet[0].title = 'Current Task Contribution';
    return outcomeSet;
  }

  calculateTaskPotentialContribution(unit: any, project: any, task: any) {
    const outcomes = this.calculateTargets(
      unit,
      unit,
      this.individualTaskPotentialFactor(project, task),
    );

    Object.keys(outcomes).forEach((key) => {
      outcomes[key] = Object.values(outcomes[key]).reduce(
        (memo: number, num: any) => memo + (num as number),
        0,
      );
    });

    outcomes['title'] = 'Potential Task Contribution';
    return outcomes;
  }

  calculateProgress(unit: any, project: any) {
    const outcomeSet: any[] = [];
    outcomeSet[0] = this.calculateTargets(unit, unit, project.taskStatusFactor.bind(project));

    outcomeSet.forEach((outcomes) => {
      Object.keys(outcomes).forEach((key) => {
        outcomes[key] = Object.values(outcomes[key]).reduce(
          (memo: number, num: any) => memo + (num as number),
          0,
        );
      });
    });

    outcomeSet[0].title = 'Your Progress';
    return outcomeSet;
  }

  targetsByGrade(unit: any, source: any) {
    const result: any[] = [];
    const outcomes = this.calculateTargets(unit, source, unit.taskStatusFactor);

    const values: Record<string, any[]> = {'0': [], '1': [], '2': [], '3': []};

    Object.keys(outcomes).forEach((key) => {
      const outcome = outcomes[key];
      Object.keys(outcome).forEach((gradeKey) => {
        values[gradeKey].push({
          label: this.sanitizer.bypassSecurityTrustHtml(
            unit.outcome(parseInt(key, 10)).abbreviation,
          ),
          value: outcome[gradeKey],
        });
      });
    });

    Object.keys(values).forEach((gradeKey) => {
      result.push({
        key: this.gradeService.grades[gradeKey],
        values: values[gradeKey],
      });
    });

    return result;
  }
}
