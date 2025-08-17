import {Component, Input, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {CourseUnit} from '../../../../models/course-map.models';
import {CourseMapStateService} from '../../../../services/course-map-state.service';
import {UnitSlotComponent} from '../unit-slot/unit-slot.component';

@Component({
  selector: 'trimester-editor',
  templateUrl: './trimester-editor.component.html',
  styleUrls: ['./trimester-editor.component.scss'],
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, UnitSlotComponent],
})
export class TrimesterEditorComponent {
  @Input() trimester!: (CourseUnit | null)[];
  @Input() trimesterKey!: 'trimester1' | 'trimester2' | 'trimester3';
  @Input() yearIndex!: number;
  @Input() trimesterIndex!: number;
  @Input() stateService!: CourseMapStateService;
  @Output() dropEvent = new EventEmitter<any>();
  @Output() deleteTrimester = new EventEmitter<void>();
  @Output() showSkillsSummary = new EventEmitter<CourseUnit>();

  readonly slotIndices = [0, 1, 2, 3];

  getTrimesterNumber(): number {
    return this.stateService.getTrimesterNumber(this.trimesterKey);
  }

  onSlotDrop(event: any): void {
    this.dropEvent.emit(event);
  }

  onDeleteTrimester(): void {
    this.deleteTrimester.emit();
  }

  onRemoveUnit(slotIndex: number): void {
    this.stateService.removeUnitFromSlot(this.yearIndex, this.trimesterKey, slotIndex);
  }

  onToggleCompletion(unit: CourseUnit): void {
    this.stateService.toggleUnitCompletion(unit);
  }

  onShowSkillsSummary(unit: CourseUnit): void {
    this.showSkillsSummary.emit(unit);
  }

  trackBySlotIndex(index: number): number {
    return index;
  }
}
