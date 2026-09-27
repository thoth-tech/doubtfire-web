import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {TeachingPeriod} from 'src/app/api/models/teaching-period';
import {Unit} from 'src/app/api/models/unit';
import {TeachingPeriodService} from 'src/app/api/services/teaching-period.service';
import {UnitService} from 'src/app/api/services/unit.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GlobalStateService, ViewType} from 'src/app/projects/states/index/global-state.service';

/**
 * The same calendar day at midnight UTC. The server keeps only the date part of
 * what it is sent, read in UTC, and a local midnight east of Greenwich is still
 * the day before in UTC, so the new unit started and ended a day early.
 */
export function asUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

@Component({
  selector: 'f-rollover',
  templateUrl: './rollover.component.html',
  styleUrl: './rollover.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class RolloverComponent implements OnInit, OnDestroy {
  @Input() unitId: number;

  public unit: Unit;

  public teachingPeriods: TeachingPeriod[] = [];

  /** The chosen teaching period, or false for custom dates. */
  public teachingPeriod: TeachingPeriod | false;

  public newStartDate: Date;
  public newEndDate: Date;

  /** True while the new unit is being made, so a second click cannot make two. */
  public creating = false;

  private periodsSub?: Subscription;

  constructor(
    private globalStateService: GlobalStateService,
    private unitService: UnitService,
    private alertService: AlertService,
    private router: Router,
    private route: ActivatedRoute,
    private teachingPeriodService: TeachingPeriodService,
  ) {}
  ngOnInit(): void {
    this.unitId = this.unitId ?? Number(this.route.parent?.snapshot.paramMap.get('unitId'));
    this.globalStateService.onLoad(() => {
      this.unitService.get(this.unitId).subscribe({
        next: (unit) => {
          this.unit = unit;
          this.globalStateService.setView(ViewType.UNIT, unit);
          setTimeout(() => {
            this.initUnit();
          });
        },
        error: (error) => {
          this.alertService.error(`Failed to load unit: ${error}`, 6000);
          this.router.navigateByUrl('/home');
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.periodsSub?.unsubscribe();
  }

  initUnit() {
    this.periodsSub?.unsubscribe();
    this.periodsSub = this.teachingPeriodService.cache.values.subscribe((periods) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      this.teachingPeriods = periods
        .filter((period) => period.endDate.getTime() > now.getTime())
        .sort(
          (left, right) =>
            left.startDate.getTime() - right.startDate.getTime() || left.id - right.id,
        );

      // Prefer the next local calendar start, including today. If every eligible period
      // has already started, use the most recently started one.
      this.teachingPeriod =
        this.teachingPeriods.find((period) => period.startDate.getTime() >= today) ??
        this.teachingPeriods.at(-1) ??
        false;
    });
  }

  public get customDatesMissing(): boolean {
    return !this.newStartDate || !this.newEndDate;
  }

  public get customDatesOutOfOrder(): boolean {
    return (
      !this.customDatesMissing &&
      asUtcDay(this.newEndDate).getTime() <= asUtcDay(this.newStartDate).getTime()
    );
  }

  public get canCreate(): boolean {
    if (!this.unit || this.creating) {
      return false;
    }
    if (this.teachingPeriod) {
      return true;
    }
    return !this.customDatesMissing && !this.customDatesOutOfOrder;
  }

  createUnit() {
    if (!this.canCreate) {
      return;
    }

    const body = this.teachingPeriod
      ? {teaching_period_id: this.teachingPeriod.id}
      : {start_date: asUtcDay(this.newStartDate), end_date: asUtcDay(this.newEndDate)};

    this.creating = true;
    this.unit.rolloverTo(body).subscribe({
      next: (response) => {
        this.alertService.success(`Unit created`, 2000);
        this.router.navigate(['/units', response.id, 'admin']);
      },
      error: (error) => {
        this.creating = false;
        this.alertService.error(`Error creating unit: ${error}`, 6000);
      },
    });
  }
}
