import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CommunicationRule} from 'src/app/api/models/doubtfire-model';
import type {UnitCommunicationsEditorComponent} from '../unit-communications-editor.component';

@Component({
  selector: 'f-communication-conditions',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './communication-conditions.component.html',
  styleUrl: './communication-conditions.component.scss',
})
export class CommunicationConditionsComponent {
  @Input({required: true}) editor: UnitCommunicationsEditorComponent;
  @Input({required: true}) rule: CommunicationRule;

  public get isAddingCondition(): boolean {
    return !!this.editor.conditionFormOpen[this.rule.id] && !this.isEditingCondition;
  }

  public get isEditingCondition(): boolean {
    return !!this.editor.editingConditionId[this.rule.id];
  }
}
