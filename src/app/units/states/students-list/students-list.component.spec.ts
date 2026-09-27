import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatOptionSelectionChange} from '@angular/material/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSelectModule} from '@angular/material/select';
import {MatSortModule} from '@angular/material/sort';
import {MatTableModule} from '@angular/material/table';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {ActivatedRoute, Router} from '@angular/router';
import {BehaviorSubject, Observable, Subject, of, throwError} from 'rxjs';
import {Project} from 'src/app/api/models/project';
import {Tutorial} from 'src/app/api/models/tutorial/tutorial';
import {Unit} from 'src/app/api/models/unit';
import {CampusService} from 'src/app/api/services/campus.service';
import {ProjectService} from 'src/app/api/services/project.service';
import {UserService} from 'src/app/api/services/user.service';
import {EmptyStateComponent} from 'src/app/common/empty-state/empty-state.component';
import {AlertService} from 'src/app/common/services/alert.service';
import {UnitStudentEnrolmentModalService} from '../../modals/unit-student-enrolment-modal/unit-student-enrolment-modal.service';
import {UnitRootStateComponent} from '../../unit-root-state.component';
import {StudentsListComponent} from './students-list.component';

function studentStub(name: string, inMyTutorial = true): Project {
  return {
    student: {name, displayName: name, username: name.toLowerCase()},
    hasTutor: () => inMyTutorial,
    matches: (text: string) => name.toLowerCase().includes(text),
  } as unknown as Project;
}

function unitStub(id: number, students: Project[], myRole = 'Convenor'): Unit {
  return {
    id,
    myRole,
    students,
    studentFilterTypeAheadData: students.map((project) => project.student.name),
    studentCache: {values: of(students)},
  } as unknown as Unit;
}

function namedUnit(id: number, studentNames: string[]): Unit {
  return unitStub(
    id,
    studentNames.map((name) => studentStub(name)),
  );
}

describe('StudentsListComponent', () => {
  const unitA = namedUnit(1, ['Ana Amos']);
  const unitB = namedUnit(2, ['Bo Barnes']);
  let routeData: BehaviorSubject<{unit: Unit}>;
  let loadStudents: ReturnType<typeof vi.fn<(unit: Unit) => Observable<Project[]>>>;

  beforeEach(async () => {
    routeData = new BehaviorSubject<{unit: Unit}>({unit: unitA});
    loadStudents = vi.fn<(unit: Unit) => Observable<Project[]>>(() => of([]));

    await TestBed.configureTestingModule({
      declarations: [UnitRootStateComponent, StudentsListComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {data: routeData, parent: {snapshot: {data: {}}}},
        },
        {provide: Router, useValue: {}},
        {provide: UserService, useValue: {currentUser: {id: 1}}},
        {provide: ProjectService, useValue: {loadStudents}},
        {provide: CampusService, useValue: {query: () => of([])}},
        {provide: AlertService, useValue: {success: () => {}, error: () => {}}},
        {provide: UnitStudentEnrolmentModalService, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(UnitRootStateComponent, {set: {template: ''}})
      .overrideComponent(StudentsListComponent, {set: {template: ''}})
      .compileComponents();
  });

  function createList(unit$?: Observable<Unit>): StudentsListComponent {
    const component = TestBed.createComponent(StudentsListComponent).componentInstance;
    component.paginator = {firstPage: () => {}} as unknown as MatPaginator;

    if (unit$) {
      component.unit$ = unit$;
    }

    component.ngOnInit();
    return component;
  }

  it('shows the students of the unit the route resolved, and follows it to another unit', () => {
    const root = TestBed.createComponent(UnitRootStateComponent).componentInstance;
    root.ngOnInit();

    const component = TestBed.createComponent(StudentsListComponent).componentInstance;
    component.paginator = {firstPage: () => {}} as unknown as MatPaginator;

    // The outlet hands the child its stream before the child runs ngOnInit.
    root.onActivate(component);
    component.ngOnInit();

    expect(component.unit.id).toBe(unitA.id);
    expect(component.dataSource.data.map((project) => project.student.displayName)).toEqual([
      'Ana Amos',
    ]);

    routeData.next({unit: unitB});

    expect(component.unit.id).toBe(unitB.id);
    expect(component.dataSource.data.map((project) => project.student.displayName)).toEqual([
      'Bo Barnes',
    ]);
  });

  it('does not rebuild the list when the route resolves the same unit again', () => {
    const root = TestBed.createComponent(UnitRootStateComponent).componentInstance;
    root.ngOnInit();

    const component = TestBed.createComponent(StudentsListComponent).componentInstance;
    component.paginator = {firstPage: () => {}} as unknown as MatPaginator;

    root.onActivate(component);
    component.ngOnInit();

    const firstData = component.dataSource.data;

    routeData.next({unit: namedUnit(unitA.id, ['Ana Amos'])});

    expect(component.unit.id).toBe(unitA.id);
    expect(component.dataSource.data).toBe(firstData);
  });

  it('shows a finished student as complete, not as all grey', () => {
    const component = createList(of(unitA));
    // The project mapping reads a grey share of 0 as 100, so a student with every
    // task complete arrives with both bars at 100.
    const finished = {
      taskStats: [
        {key: 'fail', value: 0},
        {key: 'not_started', value: 100},
        {key: 'working_on_it', value: 0},
        {key: 'ready_for_feedback', value: 0},
        {key: 'complete', value: 100},
      ],
    } as unknown as Project;

    const progress = component.progressFor(finished);

    expect(progress.complete).toBe(100);
    expect(progress.segments.map((segment) => [segment.key, segment.value])).toEqual([
      ['complete', 100],
    ]);
  });

  it('works out the grey share from what is left over', () => {
    const component = createList(of(unitA));
    const partway = {
      taskStats: [
        {key: 'fail', value: 5},
        {key: 'not_started', value: 100},
        {key: 'working_on_it', value: 10},
        {key: 'ready_for_feedback', value: 15},
        {key: 'complete', value: 40},
      ],
    } as unknown as Project;

    const progress = component.progressFor(partway);

    expect(progress.segments.map((segment) => [segment.key, segment.value])).toEqual([
      ['complete', 40],
      ['ready_for_feedback', 15],
      ['working_on_it', 10],
      ['fail', 5],
      ['not_started', 30],
    ]);
    expect(progress.segments[0].color).toBe('var(--ot-status-complete-graphic)');
    expect(progress.label).toContain('Complete 40%');
  });

  it('treats a student with no stats yet as not started instead of throwing', () => {
    const component = createList(of(unitA));

    const progress = component.progressFor({} as Project);

    expect(progress.complete).toBe(0);
    expect(progress.segments.map((segment) => segment.key)).toEqual(['not_started']);
  });

  it('records a failed load so the page can offer a retry', () => {
    loadStudents.mockReturnValueOnce(throwError(() => new Error('offline')));

    const component = createList(of(unitA));

    expect(component.loadingStudents).toBe(false);
    expect(component.loadError).toBe(true);

    component.loadStudents();

    expect(loadStudents).toHaveBeenCalledTimes(2);
    expect(component.loadError).toBe(false);
    expect(component.loadingStudents).toBe(false);
  });

  it('says when a tutor has no students in their tutorials, and when a search finds nobody', () => {
    const unit = unitStub(3, [studentStub('Cy Cole', false)], 'Tutor');
    const component = createList(of(unit));

    expect(component.staffFilter).toBe('mine');
    expect(component.emptyState).toBe('no-mine');

    component.setStaffFilter('all');
    expect(component.emptyState).toBe('none');

    component.searchText = 'zz';
    component.onSearchChange();
    expect(component.emptyState).toBe('no-match');
    expect(component.noMatchMessage).toBe('No students match "zz"');

    component.clearSearch();
    expect(component.emptyState).toBe('none');
  });

  it('skips blank suggestions instead of throwing on them', () => {
    const unit = {
      ...namedUnit(4, ['Di Dean']),
      studentFilterTypeAheadData: ['Di Dean', undefined, ''],
    } as unknown as Unit;
    const component = createList(of(unit));

    component.searchText = 'd';
    expect(() => component.onSearchChange()).not.toThrow();
    expect(component.filteredSuggestions).toEqual(['Di Dean']);
  });

  it('changes a tutorial only for a pick the user made, from the mouse or the keyboard', () => {
    const component = createList(of(unitA));
    const switchToTutorial = vi.fn();
    const project = {switchToTutorial} as unknown as Project;
    const tutorial = {id: 7} as Tutorial;

    component.onTutorialOptionChange(
      {isUserInput: false} as MatOptionSelectionChange,
      project,
      tutorial,
    );
    expect(switchToTutorial).not.toHaveBeenCalled();

    component.onTutorialOptionChange(
      {isUserInput: true} as MatOptionSelectionChange,
      project,
      tutorial,
    );
    expect(switchToTutorial).toHaveBeenCalledWith(tutorial);
  });

  it('puts the campus back when the change is refused', () => {
    const component = createList(of(unitA));
    const original = {id: 1, name: 'Burwood'};
    const project = {
      campus: original,
      switchToCampus(campus: unknown) {
        this.campus = campus;
        return throwError(() => 'Not allowed');
      },
    } as unknown as Project;

    component.changeCampus(project, {id: 2, name: 'Geelong'} as never);

    expect(project.campus).toBe(original);
  });
});

describe('StudentsListComponent empty state', () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StudentsListComponent],
      imports: [
        FormsModule,
        MatAutocompleteModule,
        MatButtonToggleModule,
        MatFormFieldModule,
        MatInputModule,
        MatPaginatorModule,
        MatSelectModule,
        MatSortModule,
        MatTableModule,
        NoopAnimationsModule,
        EmptyStateComponent,
      ],
      providers: [
        {provide: ActivatedRoute, useValue: {parent: {snapshot: {data: {}}}}},
        {provide: Router, useValue: {}},
        {provide: UserService, useValue: {currentUser: {id: 1}}},
        {provide: ProjectService, useValue: {loadStudents: () => of([])}},
        {provide: CampusService, useValue: {query: () => of([])}},
        {provide: AlertService, useValue: {success: () => {}, error: () => {}}},
        {provide: UnitStudentEnrolmentModalService, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('renders the empty state only while the filtered list has no rows', () => {
    const fixture = TestBed.createComponent(StudentsListComponent);
    const component = fixture.componentInstance;
    component.unit$ = of(unitStub(1, []));

    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('f-empty-state') as HTMLElement;
    const table = fixture.nativeElement.querySelector('table') as HTMLTableElement;
    const tableScrollContainer = table.parentElement as HTMLDivElement;

    expect(emptyState).toBeTruthy();
    expect(emptyState.closest('table')).toBeNull();
    expect(tableScrollContainer.hidden).toBe(true);

    component.dataSource.data = [
      {
        student: {name: 'Cy Cole', displayName: 'Cy Cole', username: 'cycole'},
        hasTutor: () => true,
        matches: () => true,
        taskStats: [],
      } as unknown as Project,
    ];
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('f-empty-state')).toBeFalsy();
    expect(tableScrollContainer.hidden).toBe(false);
  });

  it('shows a retryable error instead of claiming that a failed load is empty', () => {
    const projectService = TestBed.inject(ProjectService);
    const loadStudents = vi
      .spyOn(projectService, 'loadStudents')
      .mockReturnValueOnce(throwError(() => new Error('network unavailable')))
      .mockReturnValue(of([]));
    const fixture = TestBed.createComponent(StudentsListComponent);
    fixture.componentInstance.unit$ = of(unitStub(1, []));

    fixture.detectChanges();

    // The failure is shown with the shared empty state inside the alert, so check that
    // the enrolment message is not shown instead of checking for no empty state at all.
    const errorState = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(errorState.textContent).toContain('Students could not be loaded');
    expect(fixture.nativeElement.textContent).not.toContain('No students enrolled yet');

    const retry = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent.includes('Try again'));
    retry.click();
    fixture.detectChanges();

    expect(loadStudents).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('f-empty-state')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('No students enrolled yet');
  });
  it('shows skeleton rows until an empty student response has resolved', () => {
    const result: Subject<Project[]> = new Subject();
    vi.spyOn(TestBed.inject(ProjectService), 'loadStudents').mockReturnValue(result);
    const fixture = TestBed.createComponent(StudentsListComponent);
    fixture.componentInstance.unit$ = of(unitStub(1, []));
    fixture.detectChanges();
    // The loading rows are drawn in the template inside one busy status region.
    expect(fixture.nativeElement.querySelector('[aria-busy="true"][role="status"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('f-empty-state')).toBeNull();
    result.next([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"][role="status"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('f-empty-state')).not.toBeNull();
  });

  it('does not announce an empty list before a unit has resolved', () => {
    const fixture = TestBed.createComponent(StudentsListComponent);
    fixture.componentInstance.unit$ = of(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('f-empty-state')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"][role="status"]')).not.toBeNull();
  });
  it('ignores an obsolete request after changing units and cancels on destroy', () => {
    const first: Subject<Project[]> = new Subject();
    const second: Subject<Project[]> = new Subject();
    vi.spyOn(TestBed.inject(ProjectService), 'loadStudents')
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    const units: BehaviorSubject<Unit> = new BehaviorSubject(unitStub(1, []));
    const fixture = TestBed.createComponent(StudentsListComponent);
    fixture.componentInstance.unit$ = units;
    fixture.detectChanges();
    units.next(unitStub(2, []));
    fixture.detectChanges();
    expect(first.observed).toBe(false);
    first.error(new Error('Obsolete unit request'));
    fixture.detectChanges();
    expect(fixture.componentInstance.loadingStudents).toBe(true);
    expect(fixture.componentInstance.loadError).toBe(false);
    expect(fixture.nativeElement.querySelector('f-empty-state')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    fixture.destroy();
    expect(second.observed).toBe(false);
  });
});
