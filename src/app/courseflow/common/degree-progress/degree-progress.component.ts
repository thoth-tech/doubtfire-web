import { Component, OnInit, Input } from '@angular/core';
import { CourseMapStateService } from '../../services/course-map-state.service';

interface ProgressMetrics {
  overallProgress: number;
  coreUnitsProgress: number;
  electiveUnitsProgress: number;
  yearLevelProgress: { [key: number]: number };
  prerequisiteChainProgress: number;
}

@Component({
  selector: 'df-degree-progress',
  templateUrl: './degree-progress.component.html',
  styleUrls: ['./degree-progress.component.scss']
})
export class DegreeProgressComponent implements OnInit {
  metrics: ProgressMetrics;

  constructor(private courseMapState: CourseMapStateService) {}

  ngOnInit(): void {
    this.calculateProgress();
    // Subscribe to changes in course map state
    this.courseMapState.courseMapChanged$.subscribe(() => {
      this.calculateProgress();
    });
  }

  private calculateProgress(): void {
    const state = this.courseMapState.getCourseMapState();
    
    // Initialize metrics
    this.metrics = {
      overallProgress: 0,
      coreUnitsProgress: 0,
      electiveUnitsProgress: 0,
      yearLevelProgress: {},
      prerequisiteChainProgress: 0
    };

    if (!state || !state.years) return;

    let totalUnits = 0;
    let completedUnits = 0;
    let totalCoreUnits = 0;
    let completedCoreUnits = 0;
    let totalElectiveUnits = 0;
    let completedElectiveUnits = 0;
    let yearUnits: { [key: number]: { total: number; completed: number } } = {};

    // Calculate progress for each year and unit type
    state.years.forEach(year => {
      yearUnits[year.year] = { total: 0, completed: 0 };
      
      year.trimesters.forEach(trimester => {
        trimester.units.forEach(unit => {
          if (!unit.isPlaceholder) {
            totalUnits++;
            yearUnits[year.year].total++;

            if (unit.completed) {
              completedUnits++;
              yearUnits[year.year].completed++;
            }

            if (unit.isCore) {
              totalCoreUnits++;
              if (unit.completed) completedCoreUnits++;
            } else {
              totalElectiveUnits++;
              if (unit.completed) completedElectiveUnits++;
            }
          }
        });
      });
    });

    // Calculate overall progress
    this.metrics.overallProgress = (completedUnits / totalUnits) * 100;

    // Calculate core units progress
    this.metrics.coreUnitsProgress = (completedCoreUnits / totalCoreUnits) * 100;

    // Calculate elective units progress
    this.metrics.electiveUnitsProgress = (completedElectiveUnits / totalElectiveUnits) * 100;

    // Calculate year-level progress
    Object.keys(yearUnits).forEach(year => {
      const yearData = yearUnits[Number(year)];
      this.metrics.yearLevelProgress[year] = (yearData.completed / yearData.total) * 100;
    });

    // Calculate prerequisite chain progress
    // This is a simplified version - you might want to implement more complex logic
    this.calculatePrerequisiteProgress(state);
  }

  private calculatePrerequisiteProgress(state: any): void {
    let totalPrereqChains = 0;
    let completedPrereqChains = 0;

    // For each unit that has prerequisites
    state.years.forEach(year => {
      year.trimesters.forEach(trimester => {
        trimester.units.forEach(unit => {
          if (unit.prerequisites && unit.prerequisites.length > 0) {
            totalPrereqChains++;
            
            // Check if all prerequisites are completed
            const prereqsCompleted = unit.prerequisites.every((prereq: any) => 
              this.isPrerequisiteCompleted(prereq, state)
            );

            if (prereqsCompleted && unit.completed) {
              completedPrereqChains++;
            }
          }
        });
      });
    });

    this.metrics.prerequisiteChainProgress = totalPrereqChains > 0 
      ? (completedPrereqChains / totalPrereqChains) * 100
      : 100;
  }

  private isPrerequisiteCompleted(prereqId: string, state: any): boolean {
    // Search through all units to find the prerequisite unit
    for (const year of state.years) {
      for (const trimester of year.trimesters) {
        const unit = trimester.units.find((u: any) => u.id === prereqId);
        if (unit) return unit.completed;
      }
    }
    return false;
  }
}