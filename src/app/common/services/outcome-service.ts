import { Injectable } from '@angular/core';
import { GradeService } from './grade.service'; // Import GradeService
import { NewTaskService } from './new-task.service'; // Import NewTaskService

@Injectable({
  providedIn: 'root'
})
export class OutcomeService {

  alignmentLabels = [
    "The task is not related to this outcome at all",
    "The task is slightly related to this outcome",
    "The task is related to this outcome",
    "The task is a reasonable example for this outcome",
    "The task is a strong example of this outcome",
    "The task is the best example of this outcome",
  ];

  constructor(
    private gradeService: GradeService,
    private newTaskService: NewTaskService
  ) {}

  individualTaskStatusFactor(project: any, task: any) {
    return (taskDefinitionId: any) => {
      if (task.definition.id === taskDefinitionId) {
        return this.newTaskService.learningWeight.get(project.findTaskForDefinition(taskDefinitionId).status);
      } else {
        return 0;
      }
    };
  }

  individualTaskPotentialFactor(project: any, task: any) {
    return (taskDefinitionId: any) => {
      if (task.definition.id === taskDefinitionId) {
        return 1;
      } else {
        return 0;
      }
    };
  }

  calculateTargets(unit: any, source: any, taskStatusFactor: any) {
    const outcomes: any = {};
    unit.ilos.forEach((outcome: any) => {
      outcomes[outcome.id] = {
        0: [],
        1: [],
        2: [],
        3: []
      };
    });

    source.taskOutcomeAlignments.forEach((align: any) => {
      const td = unit.taskDef(align.taskDefinition.id);
      outcomes[align.learningOutcome.id][td.targetGrade].push(align.rating * taskStatusFactor(td));
    });

    Object.keys(outcomes).forEach((key: any) => {
      const outcome = outcomes[key];
      Object.keys(outcome).forEach((key1: any) => {
        const scale = Math.pow(2, parseInt(key1, 10));
        outcome[key1] = outcome[key1].reduce((memo: any, num: any) => memo + num, 0) * scale;
      });
    });

    return outcomes;
  }

  calculateTaskContribution(unit: any, project: any, task: any) {
    const outcomeSet = [];
    outcomeSet[0] = this.calculateTargets(unit, unit, this.individualTaskStatusFactor(project, task));

    Object.keys(outcomeSet[0]).forEach((key: any) => {
      outcomeSet[0][key] = outcomeSet[0][key].reduce((memo: any, num: any) => memo + num, 0);
    });

    outcomeSet[0].title = 'Current Task Contribution';
    return outcomeSet;
  }

  calculateTaskPotentialContribution(unit: any, project: any, task: any) {
    const outcomes = this.calculateTargets(unit, unit, this.individualTaskPotentialFactor(project, task));

    Object.keys(outcomes).forEach((key: any) => {
      outcomes[key] = outcomes[key].reduce((memo: any, num: any) => memo + num, 0);
    });

    outcomes['title'] = 'Potential Task Contribution';
    return outcomes;
  }

  calculateProgress(unit: any, project: any) {
    const outcomeSet = [];
    outcomeSet[0] = this.calculateTargets(unit, unit, project.taskStatusFactor.bind(project));

    outcomeSet.forEach((outcomes: any) => {
      Object.keys(outcomes).forEach((key: any) => {
        outcomes[key] = outcomes[key].reduce((memo: any, num: any) => memo + num, 0);
      });
    });

    outcomeSet[0].title = "Your Progress";
    return outcomeSet;
  }

  targetsByGrade(unit: any, source: any) {
    const result = [];
    const outcomes = this.calculateTargets(unit, source, unit.taskStatusFactor);

    const values: any = {
      '0': [],
      '1': [],
      '2': [],
      '3': []
    };

    Object.keys(outcomes).forEach((key: any) => {
      const outcome = outcomes[key];
      Object.keys(outcome).forEach((key1: any) => {
        values[key1].push({
          label: unit.outcome(parseInt(key, 10)).abbreviation,
          value: outcome[key1]
        });
      });
    });

    Object.keys(values).forEach((idx: any) => {
      result.push({
        key: this.gradeService.grades[idx],
        values: values[idx]
      });
    });

    return result;
  }
}
