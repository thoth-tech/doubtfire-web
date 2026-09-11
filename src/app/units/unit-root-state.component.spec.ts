import {beforeEach, describe, expect, it} from 'vitest';
import {Component, Input, NO_ERRORS_SCHEMA} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {ActivatedRouteSnapshot, Router, RouterModule, provideRouter} from '@angular/router';
import {Observable, firstValueFrom, of} from 'rxjs';
import {Unit} from 'src/app/api/models/unit';
import {UnitRootStateComponent} from './unit-root-state.component';

// The two components below are inert test stubs, so their one-line templates belong
// here rather than in files of their own.
/* eslint-disable @angular-eslint/component-max-inline-declarations */

function unitStub(id: number): Unit {
  return {id} as unknown as Unit;
}

@Component({
  selector: 'f-unit-child-stub',
  template: '',
  standalone: false,
})
class UnitChildStubComponent {
  @Input() public unit$: Observable<Unit>;
}

@Component({
  selector: 'f-unit-root-host',
  template: '<router-outlet></router-outlet>',
  standalone: false,
})
class UnitRootHostComponent {}

describe('UnitRootStateComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UnitRootStateComponent, UnitChildStubComponent, UnitRootHostComponent],
      imports: [RouterModule],
      providers: [
        provideRouter([
          {
            path: 'units/:unitId',
            component: UnitRootStateComponent,
            resolve: {
              unit: (route: ActivatedRouteSnapshot) =>
                of(unitStub(Number(route.paramMap.get('unitId')))),
            },
            children: [{path: 'students', component: UnitChildStubComponent}],
          },
        ]),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  // Guards the (activate) binding on the outlet. Without it the children fall back to
  // their own snapshot read and the whole fix is inert, with no other test noticing.
  it('hands its unit stream to the child the outlet activates, and keeps it on the url', async () => {
    const fixture = TestBed.createComponent(UnitRootHostComponent);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    await router.navigateByUrl('/units/1/students');
    fixture.detectChanges();

    const child = fixture.debugElement.query(By.directive(UnitChildStubComponent))
      .componentInstance as UnitChildStubComponent;
    expect(child.unit$).toBeDefined();
    expect(await firstValueFrom(child.unit$)).toMatchObject({id: 1});

    await router.navigateByUrl('/units/2/students');
    fixture.detectChanges();

    const reused = fixture.debugElement.query(By.directive(UnitChildStubComponent))
      .componentInstance as UnitChildStubComponent;
    expect(reused).toBe(child);
    expect(await firstValueFrom(child.unit$)).toMatchObject({id: 2});
  });

  it('leaves a child that already built its own unit stream alone', () => {
    const fixture = TestBed.createComponent(UnitRootStateComponent);
    const root = fixture.componentInstance;
    const own = of(unitStub(9));
    const child: {unit$?: Observable<Unit>} = {unit$: own};

    root.onActivate(child);

    expect(child.unit$).toBe(own);
  });
});
