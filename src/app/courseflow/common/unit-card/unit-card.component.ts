import {Component, Input, Output, EventEmitter, OnInit, OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatMenuModule} from '@angular/material/menu';
import {MatTooltipModule} from '@angular/material/tooltip';
import {Unit} from 'src/app/api/models/doubtfire-model';
import {CourseMapStateService} from '../../services/course-map-state.service';
import {PrerequisiteValidationResult} from '../../services/prerequisite-validation.service';
import {Subject, takeUntil} from 'rxjs';

@Component({
  selector: 'f-unit-card',
  templateUrl: './unit-card.component.html',
  styleUrls: ['./unit-card.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
  ],
})
export class UnitCardComponent implements OnInit, OnDestroy {
  @Input() unit: Unit | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Input() dragData!: any;
  @Input() showMenu = false;
  @Input() yearIndex?: number;
  @Input() trimesterKey?: 'trimester1' | 'trimester2' | 'trimester3';
  @Input() slotIndex?: number;
  @Input() showValidation: boolean = false;
  @Output() removeUnit = new EventEmitter<void>();

  validationResult: PrerequisiteValidationResult | null = null;
  private destroy$ = new Subject<void>();

  constructor(private stateService: CourseMapStateService) {}

  ngOnInit(): void {
    if (this.showValidation && this.unit && this.isPlacedInSlot()) {
      // Subscribe to validation results changes
      this.stateService.validationResults$.pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.updateValidationResult();
      });

      // Initial validation
      this.updateValidationResult();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private isPlacedInSlot(): boolean {
    return (
      this.yearIndex !== undefined &&
      this.trimesterKey !== undefined &&
      this.slotIndex !== undefined
    );
  }

  private updateValidationResult(): void {
    if (!this.unit || !this.isPlacedInSlot()) return;

    const year = this.stateService.currentState.years[this.yearIndex!];
    if (!year) return;

    const trimesterNumber = this.stateService.getTrimesterNumber(this.trimesterKey!);

    this.validationResult = this.stateService.getValidationResultForPosition(
      this.unit.code,
      year.year,
      trimesterNumber,
      this.slotIndex! + 1,
    );
  }

  get hasPrerequisiteWarnings(): boolean {
    return (this.validationResult && !this.validationResult.isValid) || false;
  }

  get warningTooltip(): string {
    if (!this.validationResult || this.validationResult.isValid) {
      return '';
    }
    return this.validationResult.warnings.join('\n');
  }

  onRemoveUnit(): void {
    this.removeUnit.emit();
  }

  getUnitLevel(): number {
    const match = this.unit.code.match(/\d/);
    return match ? parseInt(match[0], 10) : 0;
  }
}
