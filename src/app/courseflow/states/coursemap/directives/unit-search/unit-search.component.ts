import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {Unit} from 'src/app/api/models/doubtfire-model';
import {UnitService} from 'src/app/api/services/unit.service';
import {HttpErrorResponse} from '@angular/common/http';
import {CourseMapStateService} from '../../../../services/course-map-state.service';

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
  ],
})
export class UnitSearchComponent {
  unitCode = '';
  errorMessage: string | null = null;

  constructor(
    private unitService: UnitService,
    private courseMapStateService: CourseMapStateService,
  ) {}

  onSubmit(): void {
    if (!this.unitCode) {
      this.errorMessage = 'Please enter a unit code';
      return;
    }

    const trimmedCode = this.unitCode.trim().toUpperCase();
    this.errorMessage = null;

    this.unitService.getUnitByCode(trimmedCode).subscribe({
      next: (foundUnit) => {
        if (foundUnit) {
          const added = this.courseMapStateService.addElectiveUnit(foundUnit);
          if (added) {
            this.unitCode = '';
            this.errorMessage = null;
          } else {
            this.errorMessage = `Unit ${trimmedCode} cannot be added. It may already be on the map or is a required unit.`;
          }
        } else {
          this.errorMessage = `Unit code ${trimmedCode} not found`;
        }
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage = `Unit code ${trimmedCode} not found`;
        console.log(err.statusText);
      },
    });
  }
}
