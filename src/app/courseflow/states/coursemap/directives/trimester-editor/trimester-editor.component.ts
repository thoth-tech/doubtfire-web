import {Component, Input, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {CourseUnit} from '../../../../models/course-map.models';
import {CourseMapStateService} from '../../../../services/course-map-state.service';
import {UnitSlotComponent} from '../unit-slot/unit-slot.component';
import {OverloadWarningDialogComponent} from './overload-warning-dialog/overload-warning-dialog.component';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Output() dropEvent = new EventEmitter<any>();
  @Output() deleteTrimester = new EventEmitter<void>();

  private totalSlots = 4;

  constructor(private dialog: MatDialog) {}

  get slotIndices(): number[] {
    return Array.from({length: this.totalSlots}, (_, i) => i);
  }

  getTrimesterNumber(): number {
    return this.stateService.getTrimesterNumber(this.trimesterKey);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSlotDrop(event: any): void {
    this.dropEvent.emit(event);
  }

  onDeleteTrimester(): void {
    this.deleteTrimester.emit();
  }

  onRemoveUnit(slotIndex: number): void {
    this.stateService.removeUnitFromSlot(this.yearIndex, this.trimesterKey, slotIndex);
  }

  onAddSlot(): void {
    const dialogRef = this.dialog.open(OverloadWarningDialogComponent, {
      width: '450px',
      disableClose: false,
      panelClass: 'overload-warning-dialog-container',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === true) {
        // User clicked OK, proceed with adding the slot
        this.totalSlots++;
        while (this.trimester.length < this.totalSlots) {
          this.trimester.push(null);
        }
      }
      // If result is false or undefined (canceled), do nothing
    });
  }

  onRemoveSlot(slotIndex: number): void {
    if (slotIndex >= 4 && this.totalSlots > 4) {
      this.stateService.removeUnitFromSlot(this.yearIndex, this.trimesterKey, slotIndex);
      // Shift all units after this slot one position left
      for (let i = slotIndex; i < this.trimester.length - 1; i++) {
        this.trimester[i] = this.trimester[i + 1];
      }

      this.trimester.pop();
      this.totalSlots--;
    }
  }

  canRemoveSlot(slotIndex: number): boolean {
    return slotIndex >= 4;
  }

  trackBySlotIndex(index: number): number {
    return index;
  }
}
