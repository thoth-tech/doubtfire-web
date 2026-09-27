import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable, Subscription, first, of} from 'rxjs';
import {Unit, UnitRole, User, UserService} from 'src/app/api/models/doubtfire-model';
import {GlobalStateService, ViewType} from 'src/app/projects/states/index/global-state.service';

type UnitAdminTabKey =
  | 'details'
  | 'learning-outcomes'
  | 'staff'
  | 'tutorials'
  | 'students'
  | 'tasks'
  | 'groups'
  | 'communication';

export interface UnitAdminTab {
  label: string;
  routeSegment: UnitAdminTabKey;
  /**
   * One plain line under the tab's heading. The task editor lays out its own page, so
   * the tasks tab has no intro.
   */
  description?: string;
}

@Component({
  selector: 'f-unit-admin-state',
  templateUrl: './unit-admin-state.component.html',
  host: {class: 'block'},
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class UnitAdminStateComponent implements OnInit, OnDestroy {
  @Input() public unit$: Observable<Unit>;

  public readonly tabs: UnitAdminTab[] = [
    {
      label: 'Unit details',
      routeSegment: 'details',
      description: 'Name, dates, grades and the options that shape how this unit runs.',
    },
    {
      label: 'Learning outcomes',
      routeSegment: 'learning-outcomes',
      description:
        'What students should be able to do by the end of the unit, and the feedback comments for each outcome.',
    },
    {
      label: 'Staff',
      routeSegment: 'staff',
      description: 'The people who teach this unit, and what each of them can do.',
    },
    {
      label: 'Tutorials',
      routeSegment: 'tutorials',
      description: 'Tutorial streams, and the classes students enrol in within each one.',
    },
    {
      label: 'Students',
      routeSegment: 'students',
      description: 'Everyone enrolled in this unit, with their campus and tutorials.',
    },
    {label: 'Tasks', routeSegment: 'tasks'},
    {
      label: 'Groups',
      routeSegment: 'groups',
      description: 'Group sets for team work, and the groups in each one.',
    },
    {
      label: 'Communications',
      routeSegment: 'communication',
      description:
        'Rules that pick out students and send them messages or follow-up actions automatically.',
    },
  ];

  public unit: Unit | null = null;
  public staff: User[] = [];
  public assessingUnitRole: UnitRole | null = null;
  public currentTab: UnitAdminTab = this.tabs[0];
  public loadingUnit = true;

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private userService: UserService,
    private globalStateService: GlobalStateService,
  ) {}

  public ngOnInit(): void {
    this.updateCurrentTabFromState(this.route.snapshot.paramMap.get('tab'));

    this.unit$ = this.unit$ ?? of(this.route.parent?.snapshot.data.unit);
    this.subscriptions.push(
      this.unit$.pipe(first()).subscribe({
        next: (unit) => {
          // Without a unit there is nothing to administer, so stop loading and let the
          // page show its error state rather than a skeleton that never resolves.
          if (!unit) {
            this.loadingUnit = false;
            return;
          }

          this.assessingUnitRole = this.findUnitRole(unit.id);
          this.loadTutors();
          this.loadUnit(unit);
        },
        error: () => {
          this.loadingUnit = false;
        },
      }),
    );

    this.subscriptions.push(
      this.route.paramMap.subscribe((params) => this.updateCurrentTabFromState(params.get('tab'))),
    );
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  public get currentIndex(): number {
    const index = this.tabs.findIndex((tab) => tab.routeSegment === this.currentTab.routeSegment);
    return index >= 0 ? index : 0;
  }

  public isCurrent(tab: UnitAdminTab): boolean {
    return tab.routeSegment === this.currentTab.routeSegment;
  }

  private updateCurrentTabFromState(tabParam?: string | null): void {
    this.currentTab =
      this.tabs.find((tab) => tab.routeSegment === tabParam) ??
      this.tabs.find((tab) => tab.routeSegment === 'details') ??
      this.tabs[0];
  }

  private findUnitRole(unitId: number): UnitRole | null {
    const currentView = this.globalStateService.currentViewAndEntitySubject$.value;

    if (currentView?.viewType === ViewType.UNIT) {
      const currentUnitRole = currentView.entity as UnitRole;
      if (currentUnitRole?.unit?.id === unitId) {
        return currentUnitRole;
      }
    }

    let unitRole = this.globalStateService.loadedUnitRoles.currentValues.find(
      (role) => role.unit?.id === unitId,
    );

    if (
      !unitRole &&
      (this.userService.currentUser.role === 'Admin' ||
        this.userService.currentUser.role === 'Auditor')
    ) {
      unitRole = this.userService.adminOrAuditorRoleFor(
        this.userService.currentUser.role,
        unitId,
        this.userService.currentUser,
      );
    }

    return unitRole ?? null;
  }

  private loadTutors(): void {
    this.subscriptions.push(
      this.userService.getTutors().subscribe((tutors) => {
        this.staff = tutors;
      }),
    );
  }

  private loadUnit(unit: Unit): void {
    this.loadingUnit = false;
    this.unit = unit;

    if (this.assessingUnitRole) {
      this.assessingUnitRole.unit = unit;
    }

    this.globalStateService.setView(
      ViewType.UNIT,
      this.assessingUnitRole ? this.assessingUnitRole : unit,
    );
  }
}
