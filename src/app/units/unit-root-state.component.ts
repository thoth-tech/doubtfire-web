import {ChangeDetectionStrategy, Component, Input, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable, filter, map, shareReplay} from 'rxjs';
import {Unit} from 'src/app/api/models/doubtfire-model';

interface UnitRouteChild {
  unit$?: Observable<Unit>;
}

@Component({
  selector: 'f-unit-root-state',
  templateUrl: './unit-root-state.component.html',
  styleUrl: './unit-root-state.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class UnitRootStateComponent implements OnInit {
  @Input() public unit$: Observable<Unit>;
  public unit: Unit;

  // route.data emits again whenever the unit resolver re-runs, and it re-runs whenever
  // :unitId changes, so this stream follows the url even when the router reuses the
  // component instances underneath it.
  public readonly routeUnit$ = this.route.data.pipe(
    map((data) => data.unit as Unit),
    filter((unit): unit is Unit => unit != null),
    shareReplay({bufferSize: 1, refCount: true}),
  );

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.unit = data.unit;
    });
  }

  // The outlet emits this after creating the child but before its first change
  // detection, so the stream is in place before the child runs ngOnInit.
  //
  // project-root-state guards the same assignment with `'project$' in component`.
  // That check cannot work here: useDefineForClassFields is off, so an @Input with
  // no initialiser is never written to the instance and the `in` test is always
  // false. Guarding on the value instead leaves a child that has already built its
  // own unit$ alone, which keeps task-viewer-state on the behaviour RTE-02 owns.
  onActivate(component: UnitRouteChild): void {
    if (component && !component.unit$) {
      component.unit$ = this.unit$ ?? this.routeUnit$;
    }
  }
}
