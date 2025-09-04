import {Component, Input, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {Unit} from 'src/app/api/models/doubtfire-model';
import {UnitCardComponent} from '../../../../common/unit-card/unit-card.component';

@Component({
  selector: 'elective-units-list',
  templateUrl: './elective-units-list.component.html',
  styleUrls: ['./elective-units-list.component.scss'],
  standalone: true,
  imports: [CommonModule, DragDropModule, UnitCardComponent],
})
export class ElectiveUnitsListComponent {
  @Input() units!: Unit[];
  @Input() remainingSlots!: number;
  @Input() maxElectiveUnits!: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Output() dropEvent = new EventEmitter<any>();
  @Output() removeUnit = new EventEmitter<number>(); // Emit the index of the unit to remove

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDrop(event: any): void {
    this.dropEvent.emit(event);
  }

  onRemoveUnit(index: number): void {
    this.removeUnit.emit(index);
  }

  getDragData(unit: Unit) {
    return {
      unit: unit,
      sourceContainerId: 'electiveUnits',
    };
  }
}
