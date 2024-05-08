import {Component, Input, ViewChild} from '@angular/core';
import {MatTable, MatTableDataSource} from '@angular/material/table';
import {TaskDefinition, Stage, StageOption} from 'src/app/api/models/task-definition';
import {Unit} from 'src/app/api/models/unit';
@Component({
  selector: 'f-task-definition-stages',
  templateUrl: 'task-definition-stages.component.html',
  styleUrls: ['task-definition-stages.component.scss'],
})
export class TaskDefinitionStagesComponent {
  @Input() taskDefinition: TaskDefinition;
  @ViewChild('stageTable', {static: true}) table: MatTable<any>;

  public columns: string[] = ['title', 'preamble', 'options', 'row-actions'];

  public get unit(): Unit {
    return this.taskDefinition?.unit;
  }

  public addStage(): void {
    console.log(`Adding stage to ${this.taskDefinition.name}`);
    const newLength = this.taskDefinition.stages.length + 1;
    const newStage: Stage = {
      id: newLength,
      taskDefinitionId: this.taskDefinition.id,
      title: 'Source Code: Structs and Enums',
      preamble: '**Source Code: Structs and Enums**',
      options: [
        [
          'Use of structs and enumerations',
          [
            'Effectively utilises structs and enumerations',
            'Partially addresses use of structs and enums',
            'Needs improvement in use of structs and enums (Resubmit)',
            'Does not address use of structs and enums (Redo)',
          ],
        ],
        [
          'Code Quality',
          [
            'Well-organised code structure',
            'Partially organised code structure',
            'Appropriately commented code',
            'Insufficient comments',
            'Lack of comments',
            'Room for optimisation or clarification',
          ],
        ],
      ],
    };
    this.taskDefinition.addStage(newStage);
    this.table.renderRows();
  }

  addFeedbackOption(stage: Stage, optionIndex: number): void {
    // Assuming each option is an array of [string, string[]]
    // Adding a default new feedback option
    stage.options[optionIndex][1].push('New Feedback Option');
  }

  addNewCriteria(stage: Stage): void {
    // Adding a new criteria with an empty feedback options array
    stage.options.push(['New Criteria', ['Initial Feedback']]);
  }

  updatePreamble(stage: Stage): void {
    stage.preamble = `**${stage.title}**`;
  }

  public removeStage(stage: Stage): void {
    this.taskDefinition.removeStage(stage.id);
  }

  formatOptionsAsMarkdown(options: string[]): string {
    return options.map((option) => `- ${option}`).join('\n');
  }

  parseMarkdownToList(criterion: StageOption, markdownText: string): void {
    const lines = markdownText.split('\n');
    criterion[1] = lines
      .map((line) => line.trim().replace(/^- /, ''))
      .filter((line) => line !== '');
  }
}
