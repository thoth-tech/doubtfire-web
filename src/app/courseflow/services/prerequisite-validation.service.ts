import {Injectable} from '@angular/core';
import {CourseMapState} from '../models/course-map.models';
import {Unit} from 'src/app/api/models/doubtfire-model';

export interface PrerequisiteValidationResult {
  isValid: boolean;
  missingPrerequisites: Unit[];
  warnings: string[];
}

@Injectable({
  providedIn: 'root',
})
export class PrerequisiteValidationService {
  validateUnitPlacement(
    unit: Unit,
    targetYear: number,
    targetTrimester: number,
    targetSlot: number,
    courseMapState: CourseMapState,
  ): PrerequisiteValidationResult {
    const result: PrerequisiteValidationResult = {
      isValid: true,
      missingPrerequisites: [],
      warnings: [],
    };

    // Get prerequisites from unit data
    const prerequisites = this.getUnitPrerequisites(unit);

    if (prerequisites.length === 0) {
      return result; // No prerequisites to validate
    }

    // Check each prerequisite
    prerequisites.forEach((prereqCode) => {
      const prereqUnit = this.findUnitByCode(prereqCode, courseMapState);

      if (!prereqUnit) {
        result.warnings.push(`Prerequisite unit ${prereqCode} not found in course map`);
        result.isValid = false;
        return;
      }

      const prereqPosition = this.findUnitPosition(prereqUnit, courseMapState);

      if (!prereqPosition) {
        result.missingPrerequisites.push(prereqUnit);
        result.warnings.push(`Prerequisite ${prereqCode} has not been placed in the course map`);
        result.isValid = false;
      } else if (
        !this.isPositionStrictlyBefore(prereqPosition, {
          year: targetYear,
          trimester: targetTrimester,
          slot: targetSlot,
        })
      ) {
        // Check if prerequisite is in the same trimester or after
        if (
          this.isPositionSameOrAfter(prereqPosition, {
            year: targetYear,
            trimester: targetTrimester,
            slot: targetSlot,
          })
        ) {
          result.warnings.push(`Requisites Apply: ${prereqCode}`);
        } else {
          result.warnings.push(`Prerequisite ${prereqCode} must be completed before this unit`);
        }
        result.isValid = false;
      }
    });

    return result;
  }

  // New method to validate all units in the course map for prerequisite violations
  validateAllUnitsInCourseMap(
    courseMapState: CourseMapState,
  ): Map<string, PrerequisiteValidationResult> {
    const validationResults = new Map<string, PrerequisiteValidationResult>();

    // Check all placed units
    courseMapState.years.forEach((year) => {
      const trimesters = ['trimester1', 'trimester2', 'trimester3'] as const;
      trimesters.forEach((trimesterKey, trimesterIndex) => {
        const trimester = year[trimesterKey];
        if (!trimester) return;

        trimester.forEach((unit, slotIndex) => {
          if (!unit) return;

          const validationResult = this.validateUnitPlacement(
            unit,
            year.year,
            trimesterIndex + 1,
            slotIndex + 1,
            courseMapState,
          );

          if (!validationResult.isValid) {
            validationResults.set(
              `${unit.code}-${year.year}-${trimesterIndex + 1}-${slotIndex + 1}`,
              validationResult,
            );
          }
        });
      });
    });

    return validationResults;
  }

  private getUnitPrerequisites(unit: Unit): string[] {
    // Extract prerequisites from unit data
    // Based on the rake file, prerequisites are stored as JSON
    try {
      if (unit.prerequisites && typeof unit.prerequisites === 'string') {
        return JSON.parse(unit.prerequisites);
      }
      if (Array.isArray(unit.prerequisites)) {
        return unit.prerequisites as string[];
      }
      return [];
    } catch (e) {
      console.warn('Error parsing prerequisites for unit', unit.code, e);
      return [];
    }
  }

  private findUnitByCode(code: string, courseMapState: CourseMapState): Unit | null {
    // Search in all required units and elective units
    const allUnits = [...courseMapState.allRequiredUnits, ...courseMapState.electiveUnits];
    return allUnits.find((unit) => unit.code === code) || null;
  }

  private findUnitPosition(
    unit: Unit,
    courseMapState: CourseMapState,
  ): {year: number; trimester: number; slot: number} | null {
    for (let yearIndex = 0; yearIndex < courseMapState.years.length; yearIndex++) {
      const year = courseMapState.years[yearIndex];

      const trimesters = ['trimester1', 'trimester2', 'trimester3'] as const;
      for (let trimesterIndex = 0; trimesterIndex < trimesters.length; trimesterIndex++) {
        const trimester = year[trimesters[trimesterIndex]];
        if (!trimester) continue;

        for (let slotIndex = 0; slotIndex < trimester.length; slotIndex++) {
          const slotUnit = trimester[slotIndex];
          if (slotUnit && slotUnit.id === unit.id) {
            return {
              year: year.year,
              trimester: trimesterIndex + 1,
              slot: slotIndex + 1,
            };
          }
        }
      }
    }

    return null;
  }

  private isPositionStrictlyBefore(
    prereqPos: {year: number; trimester: number; slot: number},
    targetPos: {year: number; trimester: number; slot: number},
  ): boolean {
    // Check if prerequisite position comes before target position
    // Prerequisites must be in a previous trimester (not same trimester)
    if (prereqPos.year < targetPos.year) return true;
    if (prereqPos.year > targetPos.year) return false;

    // Same year, check trimester - prerequisite must be in earlier trimester
    if (prereqPos.trimester < targetPos.trimester) return true;

    // Same year and trimester OR later trimester = not valid
    return false;
  }

  private isPositionSameOrAfter(
    prereqPos: {year: number; trimester: number; slot: number},
    targetPos: {year: number; trimester: number; slot: number},
  ): boolean {
    // Check if prerequisite is in same trimester or after the target position
    if (prereqPos.year > targetPos.year) return true;
    if (prereqPos.year < targetPos.year) return false;

    // Same year, check trimester
    if (prereqPos.trimester >= targetPos.trimester) return true;

    return false;
  }

  // Helper method to check if two units have prerequisite relationship issues
  private hasPrerequisiteConflict(unit1: Unit, unit2: Unit): boolean {
    const unit1Prerequisites = this.getUnitPrerequisites(unit1);
    const unit2Prerequisites = this.getUnitPrerequisites(unit2);

    // Check if unit1 requires unit2 OR unit2 requires unit1
    return unit1Prerequisites.includes(unit2.code) || unit2Prerequisites.includes(unit1.code);
  }
}
