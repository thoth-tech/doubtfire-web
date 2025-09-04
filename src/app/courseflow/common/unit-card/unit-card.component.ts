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

  onRemoveUnit(): void {
    this.removeUnit.emit();
  }

  getUnitLevel(): number {
    const match = this.unit.code.match(/\d/);
    return match ? parseInt(match[0], 10) : 0;
  }
}
