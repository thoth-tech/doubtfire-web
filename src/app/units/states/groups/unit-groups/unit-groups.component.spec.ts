import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {BehaviorSubject, of} from 'rxjs';
import {Unit} from 'src/app/api/models/unit';
import {UserService} from 'src/app/api/services/user.service';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {UnitGroupsComponent} from './unit-groups.component';

function unitStub(id: number, myRole: string): Unit {
  return {
    id,
    myRole,
    groupSets: [],
    hasGroupwork: () => false,
    get currentUserCanViewUnitAdmin() {
      return ['Convenor', 'Admin', 'Auditor'].includes(myRole);
    },
  } as unknown as Unit;
}

describe('UnitGroupsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UnitGroupsComponent],
      providers: [
        {provide: ActivatedRoute, useValue: {parent: {snapshot: {data: {}}}}},
        {provide: UserService, useValue: {currentUser: {role: 'Tutor'}}},
        {
          provide: GlobalStateService,
          useValue: {
            currentViewAndEntitySubject$: new BehaviorSubject(null),
            // A role whose unit has not been filled in yet must not break the lookup.
            loadedUnitRoles: {currentValues: [{unit: undefined}, {unit: {id: 1}, role: 'Tutor'}]},
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(UnitGroupsComponent, {set: {template: ''}})
      .compileComponents();
  });

  function create(unit: Unit): UnitGroupsComponent {
    const component = TestBed.createComponent(UnitGroupsComponent).componentInstance;
    component.unit$ = of(unit);
    component.ngOnInit();
    return component;
  }

  it('offers group set management to convenors, not to tutors', () => {
    expect(create(unitStub(1, 'Convenor')).canManageGroupSets).toBe(true);
    expect(create(unitStub(1, 'Tutor')).canManageGroupSets).toBe(false);
  });

  it('finds the unit role even when another loaded role has no unit yet', () => {
    const component = create(unitStub(1, 'Tutor'));
    expect(component.unitRole?.role).toBe('Tutor');
  });
});
