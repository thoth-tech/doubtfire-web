import {Component, Input, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatMenuModule} from '@angular/material/menu';
import {CourseUnit} from '../../models/course-map.models';

@Component({
  selector: 'unit-card',
  templateUrl: './unit-card.component.html',
  styleUrls: ['./unit-card.component.scss'],
  standalone: true,
  imports: [CommonModule, DragDropModule, MatIconModule, MatButtonModule, MatMenuModule],
})
export class UnitCardComponent {
  @Input() unit!: CourseUnit;
  @Input() dragData!: any;
  @Input() showMenu = false;
  @Output() removeUnit = new EventEmitter<void>();
  @Output() toggleCompletion = new EventEmitter<void>();
  @Output() showSkillsSummary = new EventEmitter<CourseUnit>();

  // Track completion status locally if not available on the unit
  get isCompleted(): boolean {
    // Check if unit has a completion property, otherwise use local storage or default to false
    const unitWithCompletion = this.unit as CourseUnit & {isCompleted?: boolean};
    return unitWithCompletion.isCompleted || false;
  }

  onRemoveUnit(): void {
    // Don't allow removal of completed units
    if (this.isCompleted) {
      return;
    }
    this.removeUnit.emit();
  }

  onToggleCompletion(): void {
    this.toggleCompletion.emit();
  }

  onShowSkillsSummary(): void {
    this.showSkillsSummary.emit(this.unit);
  }
}
