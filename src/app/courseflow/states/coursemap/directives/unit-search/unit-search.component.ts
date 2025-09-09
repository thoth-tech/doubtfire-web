import {Component, Input, Output, EventEmitter, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatSelectModule} from '@angular/material/select';
import {Unit, TeachingPeriod} from 'src/app/api/models/doubtfire-model';
import {UnitWithFilterProps} from '../../../../models/unit-filter.model';

@Component({
  selector: 'unit-search',
  templateUrl: './unit-search.component.html',
  styleUrls: ['./unit-search.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
  ],
})
export class UnitSearchComponent implements OnInit {
  @Input() availableUnits!: UnitWithFilterProps[];
  @Output() unitAdded = new EventEmitter<Unit>();

  unitCode = '';
  errorMessage: string | null = null;

  // Filter properties
  selectedLevel: number | null = null;
  selectedYear: number | null = null;
  selectedTeachingPeriod: TeachingPeriod | null = null;
  selectedSpecialization: string | null = null;

  // Lists for filter options
  levels: number[] = [];
  years: number[] = [];
  teachingPeriods: TeachingPeriod[] = [];
  specializations: string[] = [];

  ngOnInit() {
    this.initializeFilterOptions();
  }

  initializeFilterOptions() {
    // Extract unique values from available units
    this.levels = Array.from(new Set(this.availableUnits.map((unit) => unit.level).filter(Boolean))).sort();
    this.years = Array.from(new Set(this.availableUnits.map((unit) => unit.year).filter(Boolean))).sort();
    this.specializations = Array.from(new Set(this.availableUnits.map((unit) => unit.specialization).filter(Boolean))).sort();
    this.teachingPeriods = Array.from(new Set(this.availableUnits.map((unit) => unit.teachingPeriod).filter(Boolean))).sort();
  }

  getFilteredUnits(): UnitWithFilterProps[] {
    return this.availableUnits.filter((unit) => {
      const levelMatch = !this.selectedLevel || unit.level === this.selectedLevel;
      const yearMatch = !this.selectedYear || unit.year === this.selectedYear;
      const specializationMatch = !this.selectedSpecialization || unit.specialization === this.selectedSpecialization;
      const teachingPeriodMatch = !this.selectedTeachingPeriod || unit.teachingPeriod?.id === this.selectedTeachingPeriod.id;
      
      return levelMatch && yearMatch && specializationMatch && teachingPeriodMatch;
    });
  }

  onSubmit(): void {
    if (!this.unitCode) {
      this.errorMessage = 'Please enter a unit code';
      return;
    }

    const trimmedCode = this.unitCode.trim().toUpperCase();
    const foundUnit = this.getFilteredUnits().find((unit) => unit.code === trimmedCode);

    if (foundUnit) {
      this.unitAdded.emit(foundUnit);
      this.unitCode = '';
      this.errorMessage = null;
    } else {
      this.errorMessage = `Unit code ${trimmedCode} not found in available units`;
    }
  }

  clearFilters(): void {
    this.selectedLevel = null;
    this.selectedYear = null;
    this.selectedTeachingPeriod = null;
    this.selectedSpecialization = null;
  }
}
