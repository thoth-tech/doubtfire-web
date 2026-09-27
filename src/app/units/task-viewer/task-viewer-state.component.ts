import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  Subject,
  asapScheduler,
  catchError,
  combineLatest,
  distinctUntilChanged,
  filter,
  first,
  map,
  observeOn,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import {TaskDefinition, Unit, UnitService} from 'src/app/api/models/doubtfire-model';

@Component({
  selector: 'f-task-viewer-state',
  templateUrl: './task-viewer-state.component.html',
  styleUrl: './task-viewer-state.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskViewerStateComponent implements OnInit, OnDestroy {
  /** The routed unit. The unit root hands this down; the route is the fallback. */
  @Input() public unit$: Observable<Unit>;

  /** The unit with its task definitions loaded, once they have arrived. */
  public unit: Unit | null = null;
  public loading = true;
  public loadFailed = false;

  /**
   * The selected task, as the template sees it. The task list picks the task the url
   * names while it is being drawn, which is after this screen's own bindings were
   * checked, so reading the subject straight into the template changed them mid-check.
   * Taking the value on the next turn lets the list settle first.
   */
  public activeTaskDef: TaskDefinition | null = null;

  private readonly retry$: BehaviorSubject<void> = new BehaviorSubject(undefined);
  private readonly destroy$: Subject<void> = new Subject();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private unitService: UnitService,
  ) {
    // The task abbreviation is deliberately not read here. This component is
    // reused when only the route parameter changes, so a snapshot read runs once
    // and leaves the first task selected for the life of the screen. The child
    // task list follows route.paramMap instead, and it is the one component
    // shared by all three routes that carry a :taskAbbreviation, so the read
    // belongs there and only there.
  }

  ngOnInit(): void {
    this.selectedTaskDefinition$
      .pipe(observeOn(asapScheduler), takeUntil(this.destroy$))
      .subscribe((taskDef) => {
        this.activeTaskDef = taskDef;
      });

    const routeUnit$ =
      this.unit$ ?? this.route.parent.data.pipe(map((data) => data.unit as Unit | undefined));

    // Every route under /units/:id/tasks resolves the unit progressively: the
    // resolver hands over the bare unit from the user's roles and leaves the page to
    // load the rest. The inbox does that itself. This screen did not, so after a
    // reload its list had no task definitions and said "No tasks to display".
    combineLatest([
      routeUnit$.pipe(
        filter((unit): unit is Unit => !!unit),
        distinctUntilChanged((a, b) => a.id === b.id),
      ),
      this.retry$,
    ])
      .pipe(
        tap(() => {
          this.loading = true;
          this.loadFailed = false;
        }),
        // switchMap so a slow answer for a unit the user has already left cannot land
        // on top of the one they are looking at now.
        switchMap(([unit]) =>
          this.unitService.get(unit.id).pipe(
            first(),
            catchError(() => of(null)),
          ),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((unit) => {
        this.unit = unit;
        this.loading = false;
        this.loadFailed = !unit;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public retryLoad(): void {
    this.retry$.next();
  }

  /**
   * Monitor and publish the selected task definition for child components.
   * We monitor the task definition list for changes in selected task definition.
   */
  selectedTaskDefinition$: BehaviorSubject<TaskDefinition> = new BehaviorSubject<TaskDefinition>(
    null,
  );

  public get taskSelected(): boolean {
    return this.selectedTaskDef !== null;
  }

  public get selectedTaskDef(): TaskDefinition {
    return this.selectedTaskDefinition$.value;
  }

  public clearTaskSelection(): void {
    this.selectedTaskDefinition$.next(null);
    if (this.route.parent?.snapshot.data.unit) {
      this.router.navigate(['../tasks'], {relativeTo: this.route, replaceUrl: true});
      return;
    }
  }
}
