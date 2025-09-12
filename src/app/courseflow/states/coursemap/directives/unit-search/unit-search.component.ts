import {Component, Input, Output, EventEmitter, OnInit, OnChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatSelectModule} from '@angular/material/select';
import {Unit} from 'src/app/api/models/doubtfire-model';

interface UnitFilters {
  level: string;
  year: string;
  period: string;
  active: string;
  specialization: string; // Future enhancement - when Unit-Specialization relationship is established
  searchText: string;
}

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
export class UnitSearchComponent implements OnInit, OnChanges {
  @Input() availableUnits!: Unit[];
  @Output() unitAdded = new EventEmitter<Unit>();

  filteredUnits: Unit[] = [];
  selectedUnit: Unit | null = null;
  errorMessage: string | null = null;

  filters: UnitFilters = {
    level: '',
    year: '',
    period: '',
    active: '',
    specialization: '', // Placeholder for future enhancement
    searchText: '',
  };

  availableYears: string[] = [];
  availablePeriods: string[] = [];

  ngOnInit(): void {
    this.initializeFilterOptions();
    this.applyFilters();
  }

  ngOnChanges(): void {
    if (this.availableUnits) {
      this.initializeFilterOptions();
      this.applyFilters();
    }
  }

  private initializeFilterOptions(): void {
    if (!this.availableUnits) return;

    // Extract unique years and periods from available units
    const years = new Set<string>();
    const periods = new Set<string>();

    this.availableUnits.forEach((unit) => {
      if (unit.teachingPeriod) {
        years.add(unit.teachingPeriod.year);
        periods.add(unit.teachingPeriod.period);
      }
    });

    this.availableYears = Array.from(years).sort((a, b) => b.localeCompare(a)); // Most recent first
    this.availablePeriods = Array.from(periods).sort();
  }

  applyFilters(): void {
    if (!this.availableUnits) {
      this.filteredUnits = [];
      return;
    }

    this.filteredUnits = this.availableUnits.filter((unit) => {
      // Level filter (first digit of unit code)
      if (this.filters.level) {
        const unitLevel = unit.code.charAt(0);
        if (unitLevel !== this.filters.level) {
          return false;
        }
      }

      // Year filter
      if (this.filters.year && unit.teachingPeriod) {
        if (unit.teachingPeriod.year !== this.filters.year) {
          return false;
        }
      }

      // Period filter
      if (this.filters.period && unit.teachingPeriod) {
        if (unit.teachingPeriod.period !== this.filters.period) {
          return false;
        }
      }

      // Active status filter
      if (this.filters.active) {
        const isActive = this.filters.active === 'true';
        if (unit.active !== isActive) {
          return false;
        }
      }

      // Search text filter
      if (this.filters.searchText) {
        const searchText = this.filters.searchText.toLowerCase();
        const codeMatch = unit.code.toLowerCase().includes(searchText);
        const nameMatch = unit.name.toLowerCase().includes(searchText);
        if (!codeMatch && !nameMatch) {
          return false;
        }
      }

      return true;
    });

    // Clear selection if selected unit is no longer in filtered results
    if (this.selectedUnit && !this.filteredUnits.some((unit) => unit.id === this.selectedUnit?.id)) {
      this.selectedUnit = null;
    }

    this.errorMessage = null;
  }

  selectUnit(unit: Unit): void {
    this.selectedUnit = unit;
    this.errorMessage = null;
  }

  addSelectedUnit(): void {
    if (this.selectedUnit) {
      this.unitAdded.emit(this.selectedUnit);
      this.selectedUnit = null;
      this.errorMessage = null;
    }
  }

  clearFilters(): void {
    this.filters = {
      level: '',
      year: '',
      period: '',
      active: '',
      specialization: '', // Placeholder for future enhancement
      searchText: '',
    };
    this.selectedUnit = null;
    this.applyFilters();
  }
}
