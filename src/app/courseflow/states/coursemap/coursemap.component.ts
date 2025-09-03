import {Component, OnInit, OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {Subject, takeUntil} from 'rxjs';
import {CourseMapStateService} from '../../services/course-map-state.service';
import {CourseMapDragDropService} from '../../services/course-map-drag-drop.service';
import {CourseMapState, CourseUnit} from '../../models/course-map.models';
import {
  UnitService,
  CourseService,
  CourseMapService,
  UnitDefinitionService,
  CourseMapUnitService,
} from 'src/app/api/services';
import {AlertService} from 'src/app/common/services/alert.service';
import {Course, Unit, UnitDefinition, CourseMapUnit} from 'src/app/api/models/doubtfire-model';
import {AuthenticationService} from 'src/app/api/services/authentication.service';

// Import child components
import {CourseYearEditorComponent} from './directives/course-year-editor/course-year-editor.component';
import {RequiredUnitsListComponent} from './directives/required-units-list/required-units-list.component';
import {ElectiveUnitsListComponent} from './directives/elective-units-list/elective-units-list.component';
import {UnitSearchComponent} from './directives/unit-search/unit-search.component';
import {SkillsSummaryDialogComponent} from '../../common/skills-summary-dialog/skills-summary-dialog.component';
import {UnitDetailsOverlayComponent} from '../../common/unit-details-overlay/unit-details-overlay.component';

@Component({
  selector: 'coursemap',
  templateUrl: './coursemap.component.html',
  styleUrls: ['./coursemap.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    DragDropModule,
    CourseYearEditorComponent,
    RequiredUnitsListComponent,
    ElectiveUnitsListComponent,
    UnitSearchComponent,
  ],
  providers: [
    UnitService,
    CourseService,
    CourseMapService,
    UnitDefinitionService,
    CourseMapUnitService,
  ],
})
export class CoursemapComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private courseMapUnits: CourseMapUnit[] | null = null;
  private unitDefinitions: UnitDefinition[] | null = null;
  private currentUserId: number | null = null;
  private currentCourseId: number | null = null;
  private currentCourseMapId: number | null = null;
  private requiredUnits: Unit[] | null = null;

  state: CourseMapState;
  units: Unit[] = [];
  courses: Course[] = [];
  errorMessage: string | null = null;

  constructor(
    private stateService: CourseMapStateService,
    private dragDropService: CourseMapDragDropService,
    private unitService: UnitService,
    private courseService: CourseService,
    private courseMapService: CourseMapService,
    private unitDefinitionService: UnitDefinitionService,
    private courseMapUnitService: CourseMapUnitService,
    private authService: AuthenticationService,
    private alerts: AlertService,
    private dialog: MatDialog,
  ) {
    this.state = this.stateService.currentState;
  }

  ngOnInit(): void {
    this.initializeSubscriptions();
    this.getCurrentUserId();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeSubscriptions(): void {
    this.stateService.state$.pipe(takeUntil(this.destroy$)).subscribe((state) => {
      this.state = state;
    });
  }

  private getCurrentUserId(): void {
    try {
      // Get user data from local storage
      const userDataJson = localStorage.getItem('doubtfire_user');

      if (userDataJson) {
        const userData = JSON.parse(userDataJson);
        if (userData && userData.id) {
          this.currentUserId = userData.id;
          this.loadCourses();
        } else {
          this.errorMessage = 'User ID not found in stored user data';
          console.error('User data format error:', userData);
        }
      } else {
        this.errorMessage = 'No authenticated user found in local storage';
        console.error('No user data in local storage');
      }
    } catch (err) {
      this.errorMessage = 'Error retrieving user information';
      console.error('Error parsing user data from local storage:', err);
    }
  }

  private loadCourses(): void {
    this.courseService.getCourses().subscribe({
      next: (data: Course[]) => {
        this.courses = data;
        console.log('Courses:', this.courses);
      },
      error: (err) => {
        this.errorMessage = 'Error fetching courses';
        console.error('Error fetching courses:', err);
      },
    });
  }

  private loadUnits(): void {
    this.unitService.getUnits().subscribe({
      next: (data: Unit[]) => {
        this.units = data;
        this.errorMessage = null;
        console.log('Available Units:', this.units);
        this.loadCourseMap();
      },
      error: (err) => {
        this.errorMessage = 'Error fetching units';
        console.error('Error fetching units:', err);
      },
    });
  }

  private loadData(): void {
    this.loadUnits();
    this.loadUnitDefinitions();
  }

  private loadCourseMap(): void {
    if (!this.currentUserId) {
      this.errorMessage = 'Missing user ID';
      return;
    }

    this.courseMapService.getCourseMapByUserId(this.currentUserId).subscribe({
      next: (courseMap) => {
        if (courseMap) {
          this.currentCourseMapId = Number(courseMap.id);
          this.currentCourseId = courseMap.courseId;
          // Load course map units after we have the course map ID
          this.loadCourseMapUnits();
        } else {
          this.errorMessage = 'No course map found for this user';
        }
      },
      error: (err) => {
        this.errorMessage = 'Error fetching course map';
        console.error('Error fetching course map:', err);
      },
    });
  }

  private loadUnitDefinitions(): void {
    this.unitDefinitionService.getDefinitions().subscribe({
      next: (data: UnitDefinition[]) => {
        this.unitDefinitions = data;
        this.errorMessage = null;
        this.initializeMap();
        console.log('Unit Definitions:', this.unitDefinitions);
      },
      error: (err) => {
        this.errorMessage = 'Error fetching unit definitions';
        console.error('Error fetching unit definitions:', err);
      },
    });
  }

  private loadCourseMapUnits(): void {
    if (!this.currentCourseMapId) {
      this.errorMessage = 'No course map ID available';
      return;
    }

    this.courseMapUnitService.getCourseMapUnitsById(this.currentCourseMapId).subscribe({
      next: (data: CourseMapUnit[]) => {
        this.courseMapUnits = data;

        // Map courseMapUnits to actual Unit instances by finding units with matching unit_definition_id
        this.requiredUnits = [];
        if (this.units && this.courseMapUnits) {
          // Create a map of unit definition code to Unit instance
          const unitMap = new Map<string, Unit>();
          this.units.forEach((unit) => {
            if (unit.code) {
              unitMap.set(unit.code, unit);
            }
          });

          // Find actual Unit instances for the course map units
          this.courseMapUnits.forEach((courseMapUnit) => {
            // Find the unit definition first
            const unitDef = this.unitDefinitions?.find((def) => def.id === courseMapUnit.unitId);
            if (unitDef && unitDef.code) {
              // Then find the corresponding Unit instance
              const unit = unitMap.get(unitDef.code);
              if (unit && !this.requiredUnits.some((existing) => existing.id === unit.id)) {
                this.requiredUnits.push(unit);
              }
            }
          });
        }

        this.initializeMap();
        console.log('Course Map Units:', this.courseMapUnits);
        console.log('Required Units (actual Unit instances):', this.requiredUnits);
      },
      error: (err) => {
        this.errorMessage = 'Error fetching course map units';
        console.error('Error fetching course map units:', err);
      },
    });
  }

  private initializeMap(): void {
    if (this.courseMapUnits && this.requiredUnits) {
      this.stateService.initializeFromCourseMapUnits(
        this.courseMapUnits,
        this.requiredUnits, // Pass actual Unit instances instead of UnitDefinitions
        this.unitDefinitions || undefined,
      );
      console.log('Course map initialized with:', {
        courseMapUnits: this.courseMapUnits,
        requiredUnits: this.requiredUnits,
      });
    }
  }

  // Public methods for child components
  addYear(): void {
    this.stateService.addYear();
  }

  addElectiveUnit(unit: Unit): boolean {
    return this.stateService.addElectiveUnit(unit);
  }

  getAvailableUnits(): Unit[] {
    // Return actual Unit instances (not UnitDefinitions) for elective selection
    // These are running courses that can be added as electives
    return this.units || [];
  }

  getRemainingElectiveSlots(): number {
    return this.stateService.getRemainingElectiveSlots();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleDrop(event: any): void {
    const result = this.dragDropService.handleDrop(event);
    if (!result.success && result.message) {
      this.alerts.error(result.message);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trackByYear(_index: number, year: any): number {
    return year.year;
  }

  onShowSkillsSummary(_unit: CourseUnit): void {
    // Extract all units placed in the course map
    const allPlacedUnits: CourseUnit[] = [];
    this.state.years.forEach((year) => {
      Object.keys(year).forEach((key) => {
        if (key.startsWith('trimester') && year[key]) {
          const trimester = year[key] as (CourseUnit | null)[];
          if (trimester) {
            trimester.forEach((u) => {
              if (u) {
                allPlacedUnits.push(u);
              }
            });
          }
        }
      });
    });

    console.log('Opening skills summary with units:', allPlacedUnits);
    const dialogRef = this.dialog.open(SkillsSummaryDialogComponent, {
      width: '800px',
      height: '600px',
      data: {
        units: allPlacedUnits,
      },
    });

    dialogRef.afterClosed().subscribe(() => {
      console.log('Skills summary dialog closed');
    });
  }

  onShowUnitDetails(unit: CourseUnit): void {
    console.log('Opening unit details for:', unit);
    const dialogRef = this.dialog.open(UnitDetailsOverlayComponent, {
      width: '800px',
      maxHeight: '90vh',
      data: unit,
    });

    dialogRef.afterClosed().subscribe(() => {
      console.log('Unit details dialog closed');
    });
  }
}
