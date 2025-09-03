/* eslint-disable @typescript-eslint/no-explicit-any */
import {Component, Input, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DragDropModule, CdkDropList, CdkDropListGroup} from '@angular/cdk/drag-drop';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatMenuModule} from '@angular/material/menu';
import {CourseUnit} from '../../../../models/course-map.models';
import {UnitCardComponent} from '../../../../common/unit-card/unit-card.component';

@Component({
  selector: 'unit-slot',
  templateUrl: './unit-slot.component.html',
  styleUrls: ['./unit-slot.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    UnitCardComponent,
  ],
})
export class UnitSlotComponent {
  @Input() unit!: CourseUnit | null;
  @Input() yearIndex!: number;
  @Input() trimesterKey!: 'trimester1' | 'trimester2' | 'trimester3';
  @Input() slotIndex!: number;
  @Output() dropEvent = new EventEmitter<any>();
  @Output() removeUnit = new EventEmitter<void>();
  @Output() toggleCompletion = new EventEmitter<CourseUnit>();
  @Output() showSkillsSummary = new EventEmitter<CourseUnit>();
  @Output() showUnitDetails = new EventEmitter<CourseUnit>();

  get dropListId(): string {
    return `${this.trimesterKey}-${this.yearIndex}-slot-${this.slotIndex}`;
  }

  get dropListData() {
    return {
      yearIndex: this.yearIndex,
      trimesterKey: this.trimesterKey,
      slotIndex: this.slotIndex,
    };
  }

  get dragData() {
    return {
      unit: this.unit,
      sourceContainerId: 'slot',
      sourceYearIndex: this.yearIndex,
      sourceTrimesterKey: this.trimesterKey,
      sourceSlotIndex: this.slotIndex,
    };
  }

  onDrop(event: any): void {
    this.dropEvent.emit(event);
  }

  onRemoveUnit(): void {
    this.removeUnit.emit();
  }

  onToggleCompletion(): void {
    if (this.unit) {
      this.toggleCompletion.emit(this.unit);
    }
  }

  onShowSkillsSummary(unit: CourseUnit): void {
    this.showSkillsSummary.emit(unit);
  }

  onShowUnitDetails(unit: CourseUnit): void {
    this.showUnitDetails.emit(unit);
  }
}
