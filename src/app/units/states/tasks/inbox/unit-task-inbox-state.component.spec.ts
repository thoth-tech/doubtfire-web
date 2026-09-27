import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, ParamMap, Router, convertToParamMap} from '@angular/router';
import {Observable, ReplaySubject, Subject, of} from 'rxjs';
import {Unit} from 'src/app/api/models/unit';
import {ProjectService} from 'src/app/api/services/project.service';
import {TaskService} from 'src/app/api/services/task.service';
import {UnitService} from 'src/app/api/services/unit.service';
import {UserService} from 'src/app/api/services/user.service';
import {SelectedTaskService} from 'src/app/projects/states/dashboard/selected-task.service';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {UnitTaskInboxStateComponent} from './unit-task-inbox-state.component';

function unitStub(id: number): Unit {
  return {id, taskDefinitions: []} as unknown as Unit;
}

describe('UnitTaskInboxStateComponent', () => {
  const emptyParamMap = convertToParamMap({});
  let fetchedUnitIds: number[];
  let unitFetches: Map<number, ReplaySubject<Unit>>;
  let holdUnitFetches: boolean;
  let paramMap$: Subject<ParamMap>;
  let queryParamMap$: Subject<ParamMap>;

  // Answers straight away unless a test holds the response back, so it can stage a
  // request for the unit the user has already navigated away from.
  function fetchUnit(unitId: number): Observable<Unit> {
    fetchedUnitIds.push(unitId);
    const response: ReplaySubject<Unit> = new ReplaySubject(1);
    unitFetches.set(unitId, response);

    if (!holdUnitFetches) {
      response.next(unitStub(unitId));
    }

    return response;
  }

  beforeEach(async () => {
    fetchedUnitIds = [];
    unitFetches = new Map();
    holdUnitFetches = false;
    // Subjects rather than of(...), which completes on subscribe and so can never
    // show a leak, which is what the teardown test below is for.
    paramMap$ = new Subject();
    queryParamMap$ = new Subject();

    await TestBed.configureTestingModule({
      declarations: [UnitTaskInboxStateComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {routeMode: 'inbox'},
              paramMap: emptyParamMap,
              queryParamMap: emptyParamMap,
            },
            paramMap: paramMap$,
            queryParamMap: queryParamMap$,
            parent: {parent: {snapshot: {data: {}}}},
          },
        },
        {provide: Router, useValue: {navigate: () => {}}},
        {
          provide: UnitService,
          useValue: {
            fetch: (unitId: number) => fetchUnit(unitId),
            get: (unitId: number) => fetchUnit(unitId),
          },
        },
        {provide: ProjectService, useValue: {loadStudents: () => of([])}},
        {
          provide: TaskService,
          useValue: {queryTasksForTaskInbox: () => of([]), taskKeyFromString: () => null},
        },
        {provide: UserService, useValue: {currentUser: {id: 1, role: 'Convenor'}}},
        {
          provide: GlobalStateService,
          useValue: {
            setInboxState: () => {},
            setNotInboxState: () => {},
            setView: () => {},
            currentViewAndEntitySubject$: {value: null},
            loadedUnitRoles: {currentValues: []},
          },
        },
        {provide: SelectedTaskService, useValue: {setSelectedTask: () => {}}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(UnitTaskInboxStateComponent, {set: {template: ''}})
      .compileComponents();
  });

  it('loads the new unit when the route resolves a different unit', () => {
    const component = TestBed.createComponent(UnitTaskInboxStateComponent).componentInstance;
    const unit$: Subject<Unit> = new Subject();
    component.unit$ = unit$;
    component.ngOnInit();

    unit$.next(unitStub(101));
    expect(fetchedUnitIds).toEqual([101]);
    expect(component.unit.id).toBe(101);

    unit$.next(unitStub(102));
    expect(fetchedUnitIds).toEqual([101, 102]);
    expect(component.unit.id).toBe(102);
  });

  it('does not reload when the route resolves the same unit again', () => {
    const component = TestBed.createComponent(UnitTaskInboxStateComponent).componentInstance;
    const unit$: Subject<Unit> = new Subject();
    component.unit$ = unit$;
    component.ngOnInit();

    unit$.next(unitStub(201));
    unit$.next(unitStub(201));

    expect(fetchedUnitIds).toEqual([201]);
  });

  // Gates card step 7. The two route subscriptions used to be left running for the
  // rest of the session, and unit$ alone cannot show that because first() closed it.
  it('stops listening to the route once it is destroyed', () => {
    const component = TestBed.createComponent(UnitTaskInboxStateComponent).componentInstance;
    const unit$: Subject<Unit> = new Subject();
    component.unit$ = unit$;
    component.ngOnInit();

    unit$.next(unitStub(301));
    expect(paramMap$.observed).toBe(true);
    expect(queryParamMap$.observed).toBe(true);

    component.ngOnDestroy();
    unit$.next(unitStub(302));

    expect(fetchedUnitIds).toEqual([301]);
    expect(unit$.observed).toBe(false);
    expect(paramMap$.observed).toBe(false);
    expect(queryParamMap$.observed).toBe(false);
  });

  // Gates the out-of-order case: the request for the unit we left must be dropped, not
  // allowed to land late and put that unit back on screen.
  it('drops a slow request for the unit that was navigated away from', () => {
    const component = TestBed.createComponent(UnitTaskInboxStateComponent).componentInstance;
    const unit$: Subject<Unit> = new Subject();
    component.unit$ = unit$;
    component.ngOnInit();

    holdUnitFetches = true;

    unit$.next(unitStub(401));
    unit$.next(unitStub(402));
    expect(fetchedUnitIds).toEqual([401, 402]);

    unitFetches.get(402).next(unitStub(402));
    expect(component.unit.id).toBe(402);

    // Unit 401's request finally answers, long after the user moved on.
    unitFetches.get(401).next(unitStub(401));

    expect(component.unit.id).toBe(402);
  });

  it('drops filters that refer to the previous unit', () => {
    const component = TestBed.createComponent(UnitTaskInboxStateComponent).componentInstance;
    const unit$: Subject<Unit> = new Subject();
    component.unit$ = unit$;
    component.ngOnInit();

    unit$.next(unitStub(501));
    component.filters = {
      tutorialIdSelected: 5010,
      tutorials: [{id: 5010}] as never,
      unitRoleIdSelected: 5011,
    };

    unit$.next(unitStub(502));

    expect(component.filters).toEqual({});
  });
});
