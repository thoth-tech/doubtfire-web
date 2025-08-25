import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {CourseYear, CourseMapState, CourseUnit, TRIMESTER_KEYS} from '../models/course-map.models';
import {Unit, UnitDefinition, CourseMapUnit} from 'src/app/api/models/doubtfire-model';

@Injectable({
  providedIn: 'root', // provide 1 instance throughout the entire application -> singleton
})
export class CourseMapStateService {
  /**
   * Manage and shares state related to a course map
   */
  private initialState: CourseMapState = {
    years: [
      {
        year: 1,
        trimester1: [null, null, null, null],
        trimester2: [null, null, null, null],
        trimester3: [null, null, null, null],
      },
    ],
    requiredUnits: [],
    electiveUnits: [],
    allRequiredUnits: [],
    maxElectiveUnits: 5,
  };

  private stateSubject = new BehaviorSubject<CourseMapState>(this.initialState);
  public state$: Observable<CourseMapState> = this.stateSubject.asObservable();

  get currentState(): CourseMapState {
    return this.stateSubject.value;
  }

  // Year Management
  addYear(): void {
    const currentState = this.currentState;
    const existingYears = currentState.years.map((y) => y.year).sort((a, b) => a - b);

    // Find the next year to add
    let nextYear: number;

    if (existingYears.length === 0) {
      nextYear = 1; // Start from year 1, not current year
    } else {
      nextYear = 1;
      for (const year of existingYears) {
        if (year === nextYear) {
          nextYear++;
        } else {
          // Found a gap, so this is the year to add
          break;
        }
      }
    }

    const newYear: CourseYear = {
      year: nextYear,
      trimester1: [null, null, null, null],
      trimester2: [null, null, null, null],
      trimester3: [null, null, null, null],
    };

    const updatedYears = [...currentState.years, newYear].sort((a, b) => a.year - b.year);

    this.updateState({
      ...currentState,
      years: updatedYears,
    });
  }

  deleteYear(index: number): void {
    const currentState = this.currentState;
    const yearToDelete = currentState.years[index];

    if (!yearToDelete) return;

    // Move required units back to the require units list
    const unitsToRestore: Unit[] = [];
    TRIMESTER_KEYS.forEach((trimesterKey) => {
      const trimester = yearToDelete[trimesterKey];
      if (trimester) {
        trimester.forEach((unit) => {
          if (unit && this.isRequiredUnit(unit)) {
            unitsToRestore.push(unit as Unit);
          }
        });
      }
    });

    const updatedRequiredUnits = [...currentState.requiredUnits];
    unitsToRestore.forEach((unit) => {
      if (!updatedRequiredUnits.some((reqUnit) => reqUnit.id === unit.id)) {
        updatedRequiredUnits.push(unit);
      }
    });

    this.updateState({
      ...currentState,
      years: currentState.years.filter((_, i) => i !== index),
      requiredUnits: updatedRequiredUnits,
    });
  }

  // Trimester Management
  addTrimester(yearIndex: number): void {
    const currentState = this.currentState;
    const year = currentState.years[yearIndex];

    if (!year) return;

    const updatedYear = {...year};

    if (!updatedYear.trimester1) {
      updatedYear.trimester1 = [null, null, null, null];
    } else if (!updatedYear.trimester2) {
      updatedYear.trimester2 = [null, null, null, null];
    } else if (!updatedYear.trimester3) {
      updatedYear.trimester3 = [null, null, null, null];
    }

    const updatedYears = [...currentState.years];
    updatedYears[yearIndex] = updatedYear;

    this.updateState({
      ...currentState,
      years: updatedYears,
    });
  }

  deleteTrimester(yearIndex: number, trimesterIndex: number): void {
    const currentState = this.currentState;
    const year = currentState.years[yearIndex];

    if (!year) return;

    const trimesterKey = TRIMESTER_KEYS[trimesterIndex];
    const trimesterToDelete = year[trimesterKey];

    if (!trimesterToDelete) return;

    // Move required units back to the list
    const unitsToRestore: Unit[] = [];

    trimesterToDelete.forEach((unit) => {
      if (unit && this.isRequiredUnit(unit)) {
        unitsToRestore.push(unit as Unit);
      }
    });

    const updatedRequiredUnits = [...currentState.requiredUnits];
    unitsToRestore.forEach((unit) => {
      if (!updatedRequiredUnits.some((reqUnit) => reqUnit.id === unit.id)) {
        updatedRequiredUnits.push(unit);
      }
    });

    const updatedYear = {...year};
    updatedYear[trimesterKey] = null;

    const updatedYears = [...currentState.years];
    updatedYears[yearIndex] = updatedYear;

    this.updateState({
      ...currentState,
      years: updatedYears,
      requiredUnits: updatedRequiredUnits,
    });
  }

  // Unit Management
  addElectiveUnit(unit: Unit): boolean {
    const currentState = this.currentState;

    if (this.isRequiredUnit(unit)) {
      return false;
    }

    if (currentState.electiveUnits.some((existing) => existing.code === unit.code)) {
      return false;
    }

    if (this.isElectiveInSlots(unit)) {
      return false;
    }

    const currentElectiveCount = this.getTotalElectiveCount();
    if (currentElectiveCount >= currentState.maxElectiveUnits) {
      return false;
    }

    this.updateState({
      ...currentState,
      electiveUnits: [...currentState.electiveUnits, unit],
    });

    return true;
  }

  removeUnitFromSlot(
    yearIndex: number,
    trimesterKey: 'trimester1' | 'trimester2' | 'trimester3',
    slotIndex: number,
  ): void {
    const currentState = this.currentState;
    const year = currentState.years[yearIndex];

    if (!year || !year[trimesterKey]) return;

    const unitToRemove = year[trimesterKey][slotIndex];
    if (!unitToRemove) return;

    const updatedYear = {...year};
    const updatedTrimester = [...updatedYear[trimesterKey]];
    updatedTrimester[slotIndex] = null;

    updatedYear[trimesterKey] = updatedTrimester;

    const updatedYears = [...currentState.years];
    updatedYears[yearIndex] = updatedYear;

    // Return the required unit (if yes) to the required unit list
    const updatedRequiredUnits = [...currentState.requiredUnits];
    if (this.isRequiredUnit(unitToRemove)) {
      if (!updatedRequiredUnits.some((reqUnit) => reqUnit.id === unitToRemove.id)) {
        updatedRequiredUnits.push(unitToRemove as Unit);
      }
    }

    this.updateState({
      ...currentState,
      years: updatedYears,
      requiredUnits: updatedRequiredUnits,
    });
  }

  // Helper Methods
  getTrimesterNumber(key: string): number {
    return parseInt(key.replace('trimester', ''), 10);
  }

  countTrimesters(year: CourseYear): number {
    let count = 0;
    if (year.trimester1) count++;
    if (year.trimester2) count++;
    if (year.trimester3) count++;
    return count;
  }

  getRemainingElectiveSlots(): number {
    /**
     * Helper function to find the remaining number of electives required
     */
    const currentState = this.currentState;
    const totalElectivesUsed = currentState.electiveUnits.length + this.countElectivesInSlots();
    return Math.max(0, currentState.maxElectiveUnits - totalElectivesUsed);
  }

  private updateState(newState: CourseMapState): void {
    /**
     * Update the current state
     */
    this.stateSubject.next(newState);
  }

  private isRequiredUnit(unit: CourseUnit): boolean {
    /**
     * Check if a unit is a required unit by comparing codes (not IDs)
     * since Unit instances and UnitDefinitions may have different IDs for the same course
     */
    return this.currentState.allRequiredUnits.some((reqUnit) => reqUnit.code === unit.code);
  }

  private isElectiveInSlots(unit: Unit): boolean {
    const currentState = this.currentState;

    for (const year of currentState.years) {
      for (const trimesterKey of TRIMESTER_KEYS) {
        const trimester = year[trimesterKey];
        if (trimester) {
          for (const slotUnit of trimester) {
            if (slotUnit?.code === unit.code && !this.isRequiredUnit(slotUnit)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
  private countElectivesInSlots(): number {
    /**
     * Count the number of electives placed in the coursemap
     */
    const currentState = this.currentState;
    let count = 0;

    currentState.years.forEach((year) => {
      TRIMESTER_KEYS.forEach((trimesterKey) => {
        const trimester = year[trimesterKey];
        if (trimester) {
          trimester.forEach((unit) => {
            if (unit && !this.isRequiredUnit(unit)) {
              count++;
            }
          });
        }
      });
    });
    return count;
  }

  private getTotalElectiveCount(): number {
    /**
     * Get the total number of elective units added (in slots + in elective list)
     */
    const currentState = this.currentState;
    return currentState.electiveUnits.length + this.countElectivesInSlots();
  }

  // Initialize state from coursemap data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initializeFromCourseMapUnits(
    courseMapUnits: CourseMapUnit[],
    allRequiredUnitDefinitions: UnitDefinition[],
    unitDefinitions?: UnitDefinition[],
  ): void {
    const years: CourseYear[] = [];
    const placedUnitIds: number[] = [];
    const missingUnitIds: number[] = [];

    // Create a map of unitId to Unit for quick lookup (for existing required units)
    const unitMap = new Map<number, Unit>();
    // Note: We don't populate unitMap since we're not using actual Unit instances for required units anymore

    // Create a map of unitDefinitionId to UnitDefinition for quick lookup
    const unitDefinitionMap = new Map<number, UnitDefinition>();
    if (unitDefinitions) {
      unitDefinitions.forEach((unitDef) => {
        if (unitDef.id !== undefined) {
          unitDefinitionMap.set(unitDef.id, unitDef);
        }
      });
    }

    // Also add the required unit definitions to the map
    allRequiredUnitDefinitions.forEach((unitDef) => {
      if (unitDef.id !== undefined) {
        unitDefinitionMap.set(unitDef.id, unitDef);
      }
    });

    // Process course map units into years/trimesters
    courseMapUnits.forEach((courseMapUnit) => {
      let unit: CourseUnit | null = null;

      // First try to find an existing unit with matching ID
      unit = unitMap.get(courseMapUnit.unitId) || null;

      // If not found, try to find a unit definition with matching ID
      if (!unit && unitDefinitionMap.has(courseMapUnit.unitId)) {
        unit = unitDefinitionMap.get(courseMapUnit.unitId)!;
      }

      if (!unit) {
        // Track missing units for reporting but don't spam console
        missingUnitIds.push(courseMapUnit.unitId);
        return; // Skip this unit if we can't find its definition
      }

      let existingYear = years.find((y) => y.year === courseMapUnit.yearSlot);

      if (!existingYear) {
        existingYear = {
          year: courseMapUnit.yearSlot,
          trimester1: [null, null, null, null],
          trimester2: [null, null, null, null],
          trimester3: [null, null, null, null],
        };
        years.push(existingYear);
      }

      // Track the unit as placed
      placedUnitIds.push(courseMapUnit.unitId);

      // Place the unit (not the courseMapUnit) in the appropriate slot
      const trimesterKey = `trimester${courseMapUnit.teachingPeriodSlot}` as keyof CourseYear;
      const slotIndex = courseMapUnit.unitSlot - 1; // Convert to 0-based index

      if (existingYear[trimesterKey] && slotIndex >= 0 && slotIndex < 4) {
        existingYear[trimesterKey][slotIndex] = unit;
      }
    });

    // Report missing units once if any were found
    if (missingUnitIds.length > 0) {
      console.warn(
        `Course map initialization: ${missingUnitIds.length} units were referenced but not found in the available units list. Unit IDs: ${missingUnitIds.join(', ')}`,
      );
      console.info(
        'This may indicate that some units are no longer available or were moved. The course map will continue to load with the available units.',
      );
    }

    // Sort years by year value
    years.sort((a, b) => a.year - b.year);

    // Filter required unit definitions to only include those not already placed
    const unplacedRequiredUnits = allRequiredUnitDefinitions.filter(
      (unitDef) => !placedUnitIds.includes(unitDef.id!),
    );

    this.updateState({
      ...this.currentState,
      years: years.length > 0 ? years : this.initialState.years,
      requiredUnits: unplacedRequiredUnits,
      allRequiredUnits: allRequiredUnitDefinitions,
      electiveUnits: [], // Start with no elective units
    });
  }

  updateRequiredUnits(unitDefinitions: UnitDefinition[]): void {
    this.updateState({
      ...this.currentState,
      requiredUnits: unitDefinitions,
    });
  }

  toggleUnitCompletion(unit: CourseUnit): void {
    // For now, we'll store completion status on the unit object itself
    // In a real implementation, this might be stored in a service or backend
    const unitWithCompletion = unit as CourseUnit & {isCompleted?: boolean};
    unitWithCompletion.isCompleted = !unitWithCompletion.isCompleted;

    // Trigger a state update to ensure components re-render
    this.updateState({
      ...this.currentState,
    });
  }
}
