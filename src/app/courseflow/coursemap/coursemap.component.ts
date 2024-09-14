import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatListModule} from '@angular/material/list';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {CdkDragDrop, moveItemInArray, transferArrayItem} from '@angular/cdk/drag-drop';
import {MatIconModule} from '@angular/material/icon';
import {HttpClientModule} from '@angular/common/http';
import {HttpClient} from '@angular/common/http';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {StateService, Transition} from '@uirouter/core';
import {AlertService} from 'src/app/common/services/alert.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {UnitService} from 'src/app/api/services/unit.service';
import {Unit} from 'src/app/api/models/doubtfire-model';
import {FormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {Course} from 'src/app/api/models/doubtfire-model';
import {CourseService} from 'src/app/api/services/course.service';
import { CourseMapService } from 'src/app/api/services/course-map.service';

type signInData =
  | {
      username: string;
      password: string;
      remember: boolean;
      autoLogin: boolean;
      auth_token?: string;
    }
  | {
      auth_token: string;
      username: string;
      remember: boolean;
      password?: string;
      autoLogin?: boolean;
    };

@Component({
  selector: 'coursemap',
  templateUrl: './coursemap.component.html',
  styleUrls: ['./coursemap.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    DragDropModule,
    MatIconModule,
    HttpClientModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
})
export class CoursemapComponent implements OnInit {
  signingIn: boolean;
  showCredentials = false;
  invalidCredentials: boolean;
  api: string;
  SSOLoginUrl: unknown;
  authMethodLoaded: boolean;
  externalName: unknown;
  formData: signInData;
  unitCode = '';
  unit: Unit | null = null;
  errorMessage: string | null = null;
  units: Unit[] = [];
  requiredUnits: unknown[] = [
    {code: 'SIT1', name: 'Introduction to Programming'},
    {code: 'SIT2', name: 'Data Structures'},
    {code: 'SIT3', name: 'Database Systems'},
    {code: 'SIT4', name: 'Web Development'},
    {code: 'SIT5', name: 'Mobile App Development'},
    {code: 'SIT6', name: 'Software Engineering'},
  ]
  courses: Course[] = [];

  testCourse: Course = {
      id: '12345',
      name: 'Introduction to Programming',
      code: 'CS101',
      year: 2024,
      version: 'v1.0',
      url: 'http://university.edu/courses/cs101'
    };


  ngOnInit(): void {
    this.formData = {
      username: '',
      password: '',
      remember: false,
      autoLogin: localStorage.getItem('autoLogin') ? true : false,
    };
    this.unitService.getUnits().subscribe({
      next: (data: Unit[]) => {
        this.units = data;
        this.errorMessage = null;
      },
      error: (err) => {
        this.errorMessage = 'Error fetching units';
        console.error('Error fetching units:', err);
      },
    });
    this.getCourses();

  }

  years = [
    {
      year: 2023,
      trimester1: [],
      trimester2: [],
      trimester3: [],
    },
  ];

  maxElectiveUnits = 5;

  electiveUnits: Unit[] = [];

  allTrimesters = [this.years[0].trimester1, this.years[0].trimester2, this.years[0].trimester3];

  get remainingSlots(): number {
    return this.maxElectiveUnits - this.electiveUnits.length;
  }

  get connectedDropLists(): string[] {
    const dropListIds: string[] = ['requiredUnits'];
    this.years.forEach((_, i) => {
      dropListIds.push(`trimester1-${i}`, `trimester2-${i}`, `trimester3-${i}`);
    });
    return dropListIds;
  }

  addYear() {
    const nextYear = this.years.length > 0 ? this.years[this.years.length - 1].year + 1 : new Date().getFullYear();
    const newYear = {
      year: nextYear,
      trimester1: [],
      trimester2: [],
      trimester3: [],
    };
    this.years.push(newYear);
  }

  deleteYear(index: number) {
    this.years.splice(index, 1);
  }

  deleteTrimester(yearIndex: number, trimesterIndex: number) {
    const trimesters = ['trimester1', 'trimester2', 'trimester3'];
    const trimesterToDelete = this.years[yearIndex][trimesters[trimesterIndex]];

    // Move all units from the trimester to the requiredUnits array
    this.requiredUnits.push(...trimesterToDelete);

    // Set the trimester to null to remove it
    this.years[yearIndex][trimesters[trimesterIndex]] = null;
  }

  addTrimester(yearIndex: number) {
    const year = this.years[yearIndex];

    if (!year.trimester1) {
      year.trimester1 = [];
    } else if (!year.trimester2) {
      year.trimester2 = [];
    } else if (!year.trimester3) {
      year.trimester3 = [];
    } else {
      // Optional: Alert or handle the case where all three trimesters already exist
      console.log('All three trimesters already exist.');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  countTrimesters(year: any): number {
    let trimesterCount = 0;
    if (year.trimester1 && year.trimester1.length > 0) trimesterCount++;
    if (year.trimester2 && year.trimester2.length > 0) trimesterCount++;
    if (year.trimester3 && year.trimester3.length > 0) trimesterCount++;
    return trimesterCount;
  }

  constructor(
    private authService: AuthenticationService,
    private state: StateService,
    private constants: DoubtfireConstants,
    private http: HttpClient,
    private transition: Transition,
    private globalState: GlobalStateService,
    private alerts: AlertService,
    private unitService: UnitService,
    private courseService: CourseService,
    private courseMapService: CourseMapService,
  ) {}

  drop(event: CdkDragDrop<string[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }
  }

  fetchUnitByCode(): void {
    if (!this.unitCode) {
      this.errorMessage = 'Please enter a unit code';
      return;
    }

    const alreadyAdded = this.electiveUnits.some(unit => unit.code === this.unitCode);

    if (alreadyAdded) {
      this.errorMessage = 'Unit already added';
      return;
    }

    const foundUnit = this.units.find(unit => unit.code === this.unitCode);

    if (foundUnit) {
      this.electiveUnits.push(foundUnit);
      this.unit = foundUnit;
      this.errorMessage = null;
    } else {
      this.errorMessage = 'Unit not found';
      this.unit = null;
    }
  }

  getCourses(): void {
    this.courseService.getCourses().subscribe(
      (data: Course[]) => {
        this.courses = data;
        console.log('Courses fetched successfully:', this.courses);
      },
      (error) => {
        console.error('Error fetching courses:', error);
      }
    );
  }

  addCourseMap(): void {
    this.courseMapService.addCourseMap(1, 1).subscribe(
      (data) => {
        console.log('Course map added:', data);
      },
      (error) => {
        console.error('Error adding course map:', error);
      }
    );
  }

}
