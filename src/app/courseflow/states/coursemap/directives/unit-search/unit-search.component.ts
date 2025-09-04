import {Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule, FormControl} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatOptionModule} from '@angular/material/core';
import {Observable} from 'rxjs';
import {map, startWith} from 'rxjs/operators';
import {Unit} from 'src/app/api/models/doubtfire-model';

@Component({
  selector: 'unit-search',
  templateUrl: './unit-search.component.html',
  styleUrls: ['./unit-search.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatAutocompleteModule,
    MatOptionModule,
  ],
})
export class UnitSearchComponent implements OnInit, OnChanges {
  @Input() availableUnits!: Unit[];
  @Input() addedUnits: Unit[] = []; // New input for already added units
  @Output() unitAdded = new EventEmitter<Unit>();

  unitCodeControl = new FormControl<string | Unit>('');
  filteredUnits: Observable<Unit[]>;
  errorMessage: string | null = null;

  constructor() {
    this.filteredUnits = this.unitCodeControl.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(this._normalizeValue(value)))
    );
  }

  ngOnInit(): void {
    // Component initialization if needed
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reinitialize filtered units when addedUnits changes
    if (changes['addedUnits']) {
      this.filteredUnits = this.unitCodeControl.valueChanges.pipe(
        startWith(this.unitCodeControl.value || ''),
        map(value => this._filter(this._normalizeValue(value)))
      );
    }
  }

  private _normalizeValue(value: string | Unit | null): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.code; // If it's a Unit object, use the code
  }

  private _filter(value: string): Unit[] {
    const filterValue = value.toLowerCase();
    // Get unit codes that have already been added
    const addedUnitCodes = this.addedUnits.map(unit => unit.code);

    return this.availableUnits.filter(unit => (
      (unit.code.toLowerCase().includes(filterValue) ||
       unit.name.toLowerCase().includes(filterValue)) &&
      // exclude already added units
      !addedUnitCodes.includes(unit.code)
    ));
  }

  onSubmit(): void {
    const unitCode = this.unitCodeControl.value;
    if (!unitCode) {
      this.errorMessage = 'Please enter a unit code';
      return;
    }

    // Normalize the value to a string
    const normalizedCode = this._normalizeValue(unitCode);
    const trimmedCode = normalizedCode.trim().toUpperCase();
    const foundUnit = this.availableUnits.find((unit) => unit.code === trimmedCode);

    if (foundUnit) {
      this.unitAdded.emit(foundUnit);
      this.unitCodeControl.setValue('');
      this.errorMessage = null;
    } else {
      this.errorMessage = `Unit code ${trimmedCode} not found in available units`;
    }
  }

  onUnitSelected(unit: Unit): void {
    this.unitAdded.emit(unit);
    this.unitCodeControl.setValue('');
    this.errorMessage = null;
  }

  displayUnit(unit: Unit): string {
    return unit ? `${unit.code} - ${unit.name}` : '';
  }
}
